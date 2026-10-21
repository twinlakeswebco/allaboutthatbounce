import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import vm from "node:vm";
import { JSDOM } from "jsdom";

const root = new URL("../public/", import.meta.url);
const exampleUnit = {
  id: "example-unit",
  name: "Example Castle",
  description: "Example inventory for testing.",
  size: "10 × 10 ft",
  mode: "dry",
  price: 160,
  photos: [],
  deposit_required: false,
};
const address = "100 Example St, Anytown, KY 40000";
const json = (value, status = 200, headers = {}) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
async function eventually(check, label = "expected page state") {
  for (let i = 0; i < 100; i++) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail(`The page did not reach: ${label}`);
}
const kentuckyNow = () => {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date())
    .split("-")
    .map(Number);
  return new Date(y, m - 1, d);
};
const nextMonthDay = (n) => {
  const now = kentuckyNow();
  const d = new Date(now.getFullYear(), now.getMonth() + 1, n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(n).padStart(2, "0")}`;
};

// Loads the real book.html and app.js with a scripted API.
async function bookingPage(t, overrides = {}) {
  const calls = [];
  const api = {
    units: [exampleUnit],
    blocked: [],
    quote: { status: "free", distance_miles: 8.2, fee: 0 },
    booking: null,
    ...overrides,
  };
  const dom = new JSDOM(await readFile(new URL(overrides.file || "book.html", root), "utf8"), {
    url: `https://example.test/${overrides.file || "book.html"}` + (overrides.search || ""),
    runScripts: "outside-only",
  });
  t.after(async () => {
    // Let any in-flight page work finish before the window goes away.
    await new Promise((resolve) => setTimeout(resolve, 60));
    dom.window.close();
  });
  dom.window.fetch = async (path, options = {}) => {
    const body = options.body ? JSON.parse(options.body) : undefined;
    calls.push({ path, method: options.method || "GET", body });
    if (api.hold) await api.hold(path, body);
    if (api.drop && path === api.drop) throw new TypeError("network dropped");
    if (path === "/api/units")
      return api.unitsError ? json({ error: "units down" }, 503) : json(api.units);
    if (path === "/api/settings")
      return json({ free_radius_miles: 15, per_mile_rate: 0.35, trip_multiplier: 4 });
    if (path.endsWith("/blocked-dates"))
      return json(
        api.blocked,
        200,
        api.serverDate ? { date: new Date(api.serverDate).toUTCString() } : {},
      );
    if (path === "/api/contact") return json({ id: "message-1", status: "received" }, 201);
    if (path === "/api/delivery-quote") {
      if (api.quoteError) return json({ error: api.quoteError }, 503);
      return json(typeof api.quote === "function" ? api.quote(body.address) : api.quote);
    }
    if (path === "/api/booking-requests") {
      if (api.bookingError) return json({ error: api.bookingError }, 409);
      return json(
        api.booking || {
          id: "request-1",
          status: "pending",
          unit_name: exampleUnit.name,
          date: body.date,
          email: body.email,
          delivery_address: body.delivery_address,
          unit_price: 160,
          delivery_quote: { fee: 0, distance_miles: 8.2, status: "free" },
          total: 160,
        },
        201,
      );
    }
    assert.fail(`Unexpected request: ${path}`);
  };
  dom.window.crypto.randomUUID = randomUUID;
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  let resets = 0;
  const renders = [];
  dom.window.turnstile = {
    reset: () => resets++,
    render: (el, options) => renders.push({ el, options }),
  };
  if (api.width) Object.defineProperty(dom.window, "innerWidth", { value: api.width });
  const context = dom.getInternalVMContext();
  const modules = new Map();
  async function load(url) {
    if (!modules.has(url.href))
      modules.set(
        url.href,
        new vm.SourceTextModule(await readFile(url, "utf8"), { context, identifier: url.href }),
      );
    return modules.get(url.href);
  }
  const main = await load(new URL("app.js", root));
  await main.link((specifier, parent) => load(new URL(specifier, parent.identifier)));
  await main.evaluate();
  const document = dom.window.document;
  const $ = (id) => document.getElementById(id);
  const helpers = {
    window: dom.window,
    document,
    calls,
    renders,
    $,
    get resets() {
      return resets;
    },
    addToken(value = "token-1") {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = "cf-turnstile-response";
      input.value = value;
      document.body.append(input);
      return input;
    },
    type(id, value) {
      const el = $(id);
      el.value = value;
      el.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
      el.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    },
    fillDetails(overrides = {}) {
      for (const [id, value] of Object.entries({
        name: "Example Customer",
        phone: "502-555-0100",
        email: "customer@example.test",
        event_type: "School event",
        ...overrides,
      }))
        helpers.type(id, value);
    },
    submit() {
      $("booking-form").dispatchEvent(
        new dom.window.Event("submit", { bubbles: true, cancelable: true }),
      );
    },
    async choose(index = 0) {
      await eventually(() => document.querySelectorAll("#units .pick-btn").length > index);
      document.querySelectorAll("#units .pick-btn")[index].click();
      await eventually(() => $("calendar").querySelector(".days button"), "calendar");
    },
    async pickDate() {
      $("calendar").querySelector('[data-nav="next"]').click();
      $("calendar").querySelector('[data-day="20"]').click();
      assert.equal($("date").value, nextMonthDay(20));
    },
    setAddress(street = "100 Example St", city = "Anytown", zip = "40000") {
      helpers.type("street", street);
      helpers.type("city", city);
      helpers.type("zip", zip);
    },
    async quoteAddress(street) {
      helpers.setAddress(street);
      $("check-delivery").click();
      await eventually(() => $("quote-status").classList.contains("ok"), "quote shown");
    },
    posts: () => calls.filter((c) => c.path === "/api/booking-requests"),
    quotes: () => calls.filter((c) => c.path === "/api/delivery-quote"),
  };
  return helpers;
}
async function completeForm(p) {
  await p.choose();
  await p.pickDate();
  p.fillDetails();
  await p.quoteAddress();
  p.addToken();
}

test("an empty catalog shows an honest empty state with contact options and no booking form", async (t) => {
  const p = await bookingPage(t, { units: [] });
  await eventually(() => !p.$("empty-state").hidden, "empty state");
  assert.equal(p.$("booking-flow").hidden, true);
  assert.equal(p.$("booking").hidden, true);
  const links = [...p.$("empty-state").querySelectorAll("a")].map((a) => a.getAttribute("href"));
  assert.ok(links.includes("tel:5028517596"));
  assert.ok(links.includes("mailto:allaboutthatbounce7596@gmail.com"));
  assert.match(p.$("empty-state").textContent, /Nothing is listed on this page yet/);
  assert.doesNotMatch(p.$("empty-state").textContent, /\$\d/);
});

test("a failed inventory load shows a recovery message and a retry that works", async (t) => {
  const p = await bookingPage(t, { unitsError: true });
  await eventually(() => !p.$("units-retry").hidden, "retry control");
  assert.match(p.$("units").textContent, /units down/);
  assert.equal(p.$("units").querySelector("button"), null);
  // Inventory returns on the next attempt.
  p.window.fetch = async (path) =>
    path === "/api/units" ? json([exampleUnit]) : json({ error: "unexpected" }, 500);
  p.$("retry-units").click();
  await eventually(() => p.$("units").querySelector(".pick-btn"), "recovered catalog");
  assert.equal(p.$("units-retry").hidden, true);
});

test("choosing an inflatable shows its details, marks it selected and loads its dates", async (t) => {
  const second = { ...exampleUnit, id: "second", name: "Second Slide", mode: "wet", price: 275 };
  const p = await bookingPage(t, { units: [exampleUnit, second], blocked: [nextMonthDay(21)] });
  await eventually(() => p.document.querySelectorAll("#units .card").length === 2);
  assert.equal(p.$("booking").hidden, true);
  const card = p.document.querySelectorAll("#units .card")[1];
  assert.match(card.textContent, /Wet \(used with water\)/);
  assert.match(card.textContent, /\$275\.00 for your event day/);
  assert.match(card.textContent, /10 × 10 ft/);
  await p.choose(1);
  assert.equal(p.$("booking").hidden, false);
  assert.equal(card.classList.contains("selected"), true);
  assert.equal(card.querySelector(".pick-btn").getAttribute("aria-pressed"), "true");
  assert.equal(
    p.document.querySelector("#units .card .pick-btn").getAttribute("aria-pressed"),
    "false",
  );
  assert.equal(p.$("unit-price").textContent, "$275.00");
  assert.ok(p.calls.some((c) => c.path === "/api/units/second/blocked-dates"));
  p.$("calendar").querySelector('[data-nav="next"]').click();
  assert.equal(p.$("calendar").querySelector('[data-day="21"]').disabled, true);
  assert.equal(p.$("calendar").querySelector('[data-day="20"]').disabled, false);
  assert.match(
    p.$("calendar").querySelector('[data-day="21"]').getAttribute("aria-label"),
    /booked or unavailable/,
  );
});

test("a calendar failure is explained and can be retried", async (t) => {
  const p = await bookingPage(t);
  const fetchOriginal = p.window.fetch;
  p.window.fetch = async (path, options) =>
    path.endsWith("/blocked-dates")
      ? json({ error: "Dates could not load." }, 503)
      : fetchOriginal(path, options);
  await eventually(() => p.document.querySelectorAll("#units .pick-btn").length === 1);
  p.document.querySelector("#units .pick-btn").click();
  await eventually(() => p.$("calendar").textContent.includes("Dates could not load."));
  assert.ok(p.$("calendar").querySelector("button"));
  assert.equal(p.$("calendar").querySelector(".days"), null);
  p.window.fetch = fetchOriginal;
  p.$("calendar").querySelector("button").click();
  await eventually(() => p.$("calendar").querySelector(".days"), "calendar after retry");
});

test("changing the address invalidates the quote and a stale quote cannot be submitted", async (t) => {
  const p = await bookingPage(t, {
    quote: (a) =>
      a.startsWith("200")
        ? { status: "fee", distance_miles: 20, fee: 28 }
        : { status: "free", distance_miles: 8.2, fee: 0 },
  });
  await completeForm(p);
  assert.equal(p.$("delivery-price").textContent, "Free");
  assert.equal(p.$("total-price").textContent, "$160.00");
  p.setAddress("200 Far Rd");
  assert.equal(p.$("total-price").textContent, "—");
  assert.equal(p.$("delivery-price").textContent, "Add address");
  assert.match(p.$("quote-status").textContent, /changed the address/);
  p.submit();
  await eventually(() => p.$("quote-status").classList.contains("ok"), "fresh quote");
  assert.equal(p.posts().length, 0, "submission must wait until the new price is reviewed");
  assert.match(p.$("booking-status").textContent, /delivery price is ready/);
  assert.match(p.$("quote-status").textContent, /Estimated total: \$188\.00/);
  assert.match(p.$("quote-status").textContent, /service area/);
  assert.equal(p.$("delivery-price").textContent, "$28.00");
  assert.equal(p.$("total-price").textContent, "$188.00");
  p.submit();
  await eventually(() => !p.$("confirmation").hidden, "confirmation");
  assert.equal(p.posts()[0].body.delivery_address, "200 Far Rd, Anytown, KY 40000");
});

test("blur never starts a quote and repeated checks share one request per address", async (t) => {
  const p = await bookingPage(t);
  await p.choose();
  p.setAddress();
  p.$("zip").dispatchEvent(new p.window.Event("focusout", { bubbles: true }));
  assert.equal(p.quotes().length, 0, "leaving the field must not start a quote");
  p.$("check-delivery").click();
  p.$("check-delivery").click();
  await eventually(() => p.$("quote-status").classList.contains("ok"));
  assert.equal(p.quotes().length, 1);
});

test("an outside-area quote blocks submission and points to Rena", async (t) => {
  const p = await bookingPage(t, { quote: { status: "outside_area", distance_miles: 90, fee: 0 } });
  await p.choose();
  await p.pickDate();
  p.fillDetails();
  p.addToken();
  p.setAddress();
  p.$("check-delivery").click();
  await eventually(() => !p.$("outside").hidden, "outside notice");
  assert.equal(p.$("total-price").textContent, "—");
  p.submit();
  await eventually(() =>
    p.$("booking-status").textContent.includes("can’t take an online request"),
  );
  assert.equal(p.posts().length, 0);
});

test("a delivery provider failure shows a readable error and never invents a price", async (t) => {
  const p = await bookingPage(t, { quoteError: "We could not calculate delivery right now." });
  await p.choose();
  p.setAddress();
  p.$("check-delivery").click();
  await eventually(() => p.$("quote-status").classList.contains("error"), "error state");
  assert.match(p.$("quote-status").textContent, /could not calculate delivery/);
  assert.equal(p.$("total-price").textContent, "—");
  assert.equal(p.$("delivery-price").textContent, "Not checked");
  assert.equal(p.$("check-delivery").disabled, false);
});

test("validation marks every incomplete field and sends nothing", async (t) => {
  const p = await bookingPage(t);
  await p.choose();
  p.type("email", "someone@nowhere");
  p.type("phone", "12345");
  p.submit();
  assert.equal(p.posts().length, 0);
  assert.match(p.$("date-error").textContent, /Choose an available date/);
  assert.match(p.$("name-error").textContent, /complete/i);
  assert.match(p.$("phone-error").textContent, /10 digits/);
  assert.match(p.$("email-error").textContent, /valid email/);
  assert.match(p.$("event_type-error").textContent, /complete/i);
  for (const id of ["street", "city", "zip"])
    assert.match(p.$(id + "-error").textContent, /complete/i, id);
  p.type("zip", "4000");
  p.submit();
  assert.match(p.$("zip-error").textContent, /5-digit ZIP/);
  assert.equal(p.$("name").getAttribute("aria-invalid"), "true");
  p.type("name", "Example Customer");
  assert.equal(p.$("name-error").textContent, "");
  assert.equal(p.$("name").getAttribute("aria-invalid"), "false");
});

test("submission requires the security check to be completed", async (t) => {
  const p = await bookingPage(t);
  await p.choose();
  await p.pickDate();
  p.fillDetails();
  await p.quoteAddress();
  p.submit();
  await eventually(() => p.$("booking-status").textContent.includes("security check"));
  assert.equal(p.posts().length, 0);
});

test("a valid request is sent without client prices and ends in a pending acknowledgement", async (t) => {
  const p = await bookingPage(t);
  await completeForm(p);
  p.submit();
  await eventually(() => !p.$("confirmation").hidden, "confirmation");
  const [post] = p.posts();
  assert.equal(post.method, "POST");
  assert.equal(post.body.unit_id, "example-unit");
  assert.equal(post.body.date, nextMonthDay(20));
  assert.equal(post.body.turnstile_token, "token-1");
  assert.equal(post.body.website, "");
  assert.ok(post.body.idempotency_key);
  assert.equal(post.body.delivery_address, address);
  for (const part of ["street", "city", "zip"]) assert.equal(part in post.body, false, part);
  for (const key of ["total", "price", "delivery_fee", "unit_price"])
    assert.equal(key in post.body, false, key);
  assert.equal(p.$("booking-flow").hidden, true);
  const text = p.$("confirmation").textContent;
  assert.match(text, /Pending/);
  assert.match(text, /not booked yet/);
  assert.match(text, /not held until Rena confirms/);
  assert.match(text, /queued a receipt email to customer@example\.test/);
  assert.match(text, /cash or\s+check at delivery/);
  assert.match(text, /request-1/);
  assert.doesNotMatch(text, /delivered|has been sent to your inbox/i);
  assert.equal(p.window.document.activeElement, p.$("confirm-title"));
  assert.equal(p.resets, 1);
});

test("a failed submission keeps the form, shows the error and reuses the key only for identical retries", async (t) => {
  const p = await bookingPage(t, {
    bookingError: "That inflatable or date is no longer available.",
  });
  await completeForm(p);
  p.submit();
  await eventually(() => p.$("booking-status").textContent.includes("no longer available"));
  await eventually(() => p.$("send-request").textContent.trim() === "Send rental request");
  assert.equal(p.$("confirmation").hidden, true);
  assert.equal(p.$("name").value, "Example Customer");
  assert.equal(p.$("send-request").disabled, false);
  assert.equal(p.$("send-request").textContent.trim(), "Send rental request");
  p.submit();
  await eventually(() => p.posts().length === 2);
  assert.equal(p.posts()[1].body.idempotency_key, p.posts()[0].body.idempotency_key);
  await eventually(() => p.$("send-request").textContent.trim() === "Send rental request");
  p.type("phone", "502-555-0111");
  p.submit();
  await eventually(() => p.posts().length === 3);
  assert.notEqual(p.posts()[2].body.idempotency_key, p.posts()[0].body.idempotency_key);
});

test("a request already taken by someone else clears the chosen date", async (t) => {
  const blocked = [];
  const p = await bookingPage(t, { blocked, bookingError: "That date is no longer available." });
  await completeForm(p);
  blocked.push(nextMonthDay(20));
  p.submit();
  await eventually(() => p.$("date").value === "", "date cleared");
  assert.match(p.$("date-error").textContent, /just taken/);
  assert.equal(p.$("confirmation").hidden, true);
});

test("special arrangements explain deposits after approval", async (t) => {
  const p = await bookingPage(t, { units: [{ ...exampleUnit, deposit_required: true }] });
  await p.choose();
  assert.equal(p.$("deposit").hidden, false);
  assert.match(p.$("deposit").textContent, /payment instructions after approving/);
});

test("?unit preselects a listed inflatable and explains an unlisted one", async (t) => {
  const known = await bookingPage(t, { search: "?unit=example-unit" });
  await eventually(() => !known.$("booking").hidden, "preselected booking");
  assert.equal(known.$("chosen-name").textContent, "Example Castle");
  const unknown = await bookingPage(t, { search: "?unit=missing" });
  await eventually(() => !unknown.$("units-notice").hidden, "notice");
  assert.equal(unknown.$("booking").hidden, true);
  assert.match(unknown.$("units-notice").textContent, /isn’t listed right now/);
});

test("the booking page contains no inline styles (blocked by the site's CSP) or private origin", async () => {
  const html = await readFile(new URL("book.html", root), "utf8");
  assert.doesNotMatch(html, /\sstyle\s*=/i);
  assert.doesNotMatch(await readFile(new URL("contact.html", root), "utf8"), /\sstyle\s*=/i);
  const js = await readFile(new URL("app.js", root), "utf8");
  assert.doesNotMatch(js, /setAttribute\(\s*["']style["']/);
  assert.match(html, /allaboutthatbounce7596@gmail\.com/);
  assert.match(html, /502-851-7596/);
  for (const text of [html, js]) assert.doesNotMatch(text, /Grayson|ORIGIN_ADDRESS/);
});

test("a slow quote for an earlier address can never replace the quote for the current one", async (t) => {
  const holds = new Map();
  const hold = (key) => {
    let release;
    holds.set(key, new Promise((resolve) => (release = resolve)));
    return release;
  };
  const releaseOld = hold("100 Example St, Anytown, KY 40000");
  const releaseNew = hold("200 Far Rd, Anytown, KY 40000");
  const p = await bookingPage(t, {
    hold: (path, body) => (path === "/api/delivery-quote" ? holds.get(body.address) : undefined),
    quote: (a) =>
      a.startsWith("200")
        ? { status: "fee", distance_miles: 20, fee: 28 }
        : { status: "free", distance_miles: 8.2, fee: 0 },
  });
  await p.choose();
  await p.pickDate();
  p.fillDetails();
  p.addToken();
  p.setAddress();
  p.$("check-delivery").click();
  p.setAddress("200 Far Rd");
  p.$("check-delivery").click();
  releaseNew();
  await eventually(() => p.$("delivery-price").textContent === "$28.00", "new quote");
  releaseOld();
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(p.$("delivery-price").textContent, "$28.00");
  assert.equal(p.$("total-price").textContent, "$188.00");
  p.submit();
  await eventually(() => p.posts().length === 1, "post");
  assert.equal(p.posts()[0].body.delivery_address, "200 Far Rd, Anytown, KY 40000");
});

test("editing the address while Send is waiting for a quote does not send or show an old price", async (t) => {
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  const p = await bookingPage(t, {
    hold: (path) => (path === "/api/delivery-quote" ? gate : undefined),
  });
  await completeFormWithoutQuote(p);
  p.submit();
  await eventually(() => p.$("delivery-price").textContent === "Checking…");
  p.setAddress("999 Other Rd");
  release();
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(p.posts().length, 0);
  assert.equal(p.$("total-price").textContent, "—");
  assert.match(p.$("quote-status").textContent, /changed the address/);
  assert.equal(p.$("booking-status").textContent, "");
});

async function completeFormWithoutQuote(p) {
  await p.choose();
  await p.pickDate();
  p.fillDetails();
  p.setAddress();
  p.addToken();
}

test("availability for an earlier inflatable never replaces the one now selected", async (t) => {
  const second = { ...exampleUnit, id: "second", name: "Second Slide" };
  const releases = {};
  const holds = {
    "/api/units/example-unit/blocked-dates": new Promise((r) => (releases.first = r)),
    "/api/units/second/blocked-dates": new Promise((r) => (releases.second = r)),
  };
  const p = await bookingPage(t, {
    units: [exampleUnit, second],
    hold: (path) => holds[path],
    blocked: [],
  });
  const dates = {
    "/api/units/example-unit/blocked-dates": [nextMonthDay(20)],
    "/api/units/second/blocked-dates": [nextMonthDay(21)],
  };
  p.window.fetchOverride = dates;
  const original = p.window.fetch;
  p.window.fetch = async (path, options) =>
    path.endsWith("/blocked-dates")
      ? (await holds[path], json(dates[path]))
      : original(path, options);
  await eventually(() => p.document.querySelectorAll("#units .pick-btn").length === 2);
  const buttons = p.document.querySelectorAll("#units .pick-btn");
  buttons[0].click();
  buttons[1].click();
  releases.second();
  await eventually(() => p.$("calendar").querySelector(".days"), "second unit calendar");
  releases.first();
  await new Promise((resolve) => setTimeout(resolve, 50));
  p.$("calendar").querySelector('[data-nav="next"]').click();
  assert.equal(p.$("calendar").querySelector('[data-day="21"]').disabled, true);
  assert.equal(p.$("calendar").querySelector('[data-day="20"]').disabled, false);
  assert.equal(p.$("chosen-name").textContent, "Second Slide");
});

test("switching inflatables clears a date that was chosen for the previous one", async (t) => {
  const second = { ...exampleUnit, id: "second", name: "Second Slide" };
  const p = await bookingPage(t, { units: [exampleUnit, second] });
  await p.choose(0);
  await p.pickDate();
  assert.equal(p.$("date").value, nextMonthDay(20));
  await p.choose(1);
  assert.equal(p.$("date").value, "");
  assert.match(p.$("date-readout").textContent, /pick your date again/);
});

test("an unknown submission outcome says so and a resend reuses the same key", async (t) => {
  const p = await bookingPage(t, { drop: "/api/booking-requests" });
  await completeForm(p);
  p.submit();
  await eventually(() => p.$("booking-status").textContent.includes("couldn’t confirm"));
  assert.doesNotMatch(p.$("booking-status").textContent, /was not submitted|not been sent/i);
  assert.match(p.$("booking-status").textContent, /502-851-7596/);
  await eventually(() => p.$("send-request").textContent.trim() === "Send rental request");
  p.submit();
  await eventually(() => p.posts().length === 2);
  assert.equal(p.posts()[1].body.idempotency_key, p.posts()[0].body.idempotency_key);
});

test("common phone formats are accepted and sent as typed", async (t) => {
  for (const phone of ["+1 (502) 555-0100", "502.555.0100", "(502) 555 0100"]) {
    const p = await bookingPage(t);
    await completeForm(p);
    p.type("phone", phone);
    p.submit();
    await eventually(() => p.posts().length === 1, phone);
    assert.equal(p.posts()[0].body.phone, phone);
  }
});

test("the honeypot is hidden from assistive technology and cannot take focus", async () => {
  for (const name of ["book.html", "contact.html"]) {
    const html = await readFile(new URL(name, root), "utf8");
    assert.match(
      html,
      /<div class="honeypot" aria-hidden="true" inert>\s*<input[^>]*name="website"[^>]*tabindex="-1"/,
      name,
    );
  }
});

test("the page offers no live region around the whole review panel", async () => {
  const html = await readFile(new URL("book.html", root), "utf8");
  assert.doesNotMatch(html, /<dl class="review-list"[^>]*aria-live/);
});

test("calendar dates follow the server's clock, not the device's", async (t) => {
  // The server says it is the 15th, three months from now; the device clock disagrees.
  const now = new Date();
  const serverDate = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 3, 15, 16, 0, 0);
  const p = await bookingPage(t, { serverDate });
  await p.choose();
  const month = new Date(now.getUTCFullYear(), now.getUTCMonth() + 3, 1).toLocaleDateString(
    "en-US",
    { month: "long", year: "numeric" },
  );
  assert.equal(p.$("calendar").querySelector("strong").textContent, month);
  assert.equal(p.$("calendar").querySelector('[data-nav="prev"]').disabled, true);
  assert.equal(p.$("calendar").querySelector('[data-day="14"]').disabled, true);
  assert.match(
    p.$("calendar").querySelector('[data-day="14"]').getAttribute("aria-label"),
    /already passed/,
  );
  assert.equal(p.$("calendar").querySelector('[data-day="15"]').disabled, false);
});

test("a chosen date that the server's clock now calls past is cleared after a rejection", async (t) => {
  const p = await bookingPage(t, { bookingError: "Choose an upcoming date." });
  await completeForm(p);
  // After the failed send the server reports a date past the chosen one.
  p.window.fetch = ((original) => async (path, options) =>
    path.endsWith("/blocked-dates")
      ? json([], 200, { date: new Date(Date.parse(nextMonthDay(20)) + 3 * 864e5).toUTCString() })
      : original(path, options))(p.window.fetch);
  p.submit();
  await eventually(() => p.$("date").value === "", "stale date cleared");
  assert.match(p.$("date-error").textContent, /has passed/);
});

for (const file of ["book.html", "contact.html"]) {
  test(`${file}: the form always carries an empty honeypot, and a filled one reaches the server`, async (t) => {
    const p = await bookingPage(t, { file });
    p.addToken();
    const honeypot = p.document.querySelector(".honeypot input[name=website]");
    assert.ok(honeypot, "honeypot input exists inside the hidden wrapper");
    assert.equal(honeypot.value, "");
    assert.equal(honeypot.closest(".honeypot").hasAttribute("inert"), true);
    assert.equal(honeypot.tabIndex, -1);
    const send = async (website) => {
      if (file === "book.html") {
        await completeForm(p);
        honeypot.value = website;
        p.submit();
        await eventually(() => p.posts().length > 0);
        return p.posts().at(-1).body;
      }
      for (const [id, value] of [
        ["name", "Example Customer"],
        ["email", "customer@example.test"],
        ["message", "Hello"],
      ])
        p.type(id, value);
      honeypot.value = website;
      p.$("contact-form").dispatchEvent(
        new p.window.Event("submit", { bubbles: true, cancelable: true }),
      );
      await eventually(() => p.calls.some((c) => c.path === "/api/contact"));
      return p.calls.find((c) => c.path === "/api/contact").body;
    };
    const sent = await send("");
    assert.equal(sent.website, "", "an ordinary submission sends an empty honeypot value");
    assert.equal("website" in sent, true);
    if (file === "contact.html") {
      await eventually(
        () => p.$("contact-form").querySelector("button").textContent === "Send message",
      );
      p.calls.length = 0;
      for (const [id, value] of [
        ["name", "Example Customer"],
        ["email", "customer@example.test"],
        ["message", "Hello"],
      ])
        p.type(id, value);
      honeypot.value = "spam";
      p.$("contact-form").dispatchEvent(
        new p.window.Event("submit", { bubbles: true, cancelable: true }),
      );
      await eventually(() => p.calls.some((c) => c.path === "/api/contact"));
      assert.equal(p.calls.find((c) => c.path === "/api/contact").body.website, "spam");
    }
  });
}

test("a populated honeypot on the booking form is sent to the server unchanged", async (t) => {
  const p = await bookingPage(t, { bookingError: "Unable to submit request." });
  await completeForm(p);
  p.document.querySelector(".honeypot input[name=website]").value = "spam";
  p.submit();
  await eventually(() => p.posts().length === 1);
  assert.equal(p.posts()[0].body.website, "spam");
});

test("Turnstile is rendered once per slot, compact on very narrow screens and normal otherwise", async (t) => {
  for (const [width, size] of [
    [320, "compact"],
    [339, "compact"],
    [340, "normal"],
    [1280, "normal"],
  ]) {
    for (const file of ["book.html", "contact.html"]) {
      const p = await bookingPage(t, { file, width });
      assert.equal(p.renders.length, 1, `${file}@${width}`);
      assert.equal(p.renders[0].options.size, size, `${file}@${width}`);
      assert.equal(p.renders[0].options.action, file === "book.html" ? "booking" : "contact");
      assert.match(p.renders[0].options.sitekey, /^0x/);
    }
  }
});
