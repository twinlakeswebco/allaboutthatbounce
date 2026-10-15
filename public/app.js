import * as api from "./api.js";
export const $ = (id) => document.getElementById(id);
export const money = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
export function text(tag, value, className) {
  const e = document.createElement(tag);
  e.textContent = value;
  if (className) e.className = className;
  return e;
}
export function setupMenu() {
  const m = $("menu");
  m.addEventListener("click", () => {
    const open = m.getAttribute("aria-expanded") !== "true";
    m.setAttribute("aria-expanded", String(open));
    $("navigation").hidden = !open;
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && m.getAttribute("aria-expanded") === "true") {
      m.click();
      m.focus();
    }
  });
}
export function validate(form) {
  let first;
  for (const el of form.querySelectorAll("input:not([type=hidden]),select,textarea")) {
    if (el.disabled) continue;
    let message = el.validity.valueMissing
      ? "Please complete this field."
      : el.validity.typeMismatch
        ? "Enter a valid email address."
        : !el.validity.valid
          ? "Enter a valid value within the allowed range."
          : "";
    if (el.required && el.value.trim() === "") message = "Please complete this field.";
    if (el.type === "tel" && el.value.replace(/\D/g, "").length < 10)
      message = "Enter a phone number with at least 10 digits.";
    const err = $(el.id + "-error");
    if (err) err.textContent = message;
    el.setAttribute("aria-invalid", String(!!message));
    if (message && !first) first = el;
  }
  if (first) first.focus();
  return !first;
}
export function safePhoto(src) {
  return typeof src === "string" &&
    (/^(placeholder\.svg|data:image\/(jpeg|png|webp);base64,)/.test(src) || /^https:\/\//.test(src))
    ? src
    : "placeholder.svg";
}
export function unitCard(u, choose) {
  const c = text("article", "", "card");
  const img = document.createElement("img");
  const src = safePhoto(u.photos[0]);
  img.src = src;
  img.alt =
    src === "placeholder.svg"
      ? `Placeholder artwork for ${u.name}; actual photo pending`
      : `${u.name} inflatable`;
  img.width = 800;
  img.height = 600;
  img.loading = "lazy";
  img.addEventListener(
    "error",
    () => {
      img.src = "placeholder.svg";
    },
    { once: true },
  );
  c.append(img);
  const b = text("div", "", "card-body");
  b.append(
    text("span", u.mode === "wet" ? "Wet inflatable" : "Dry inflatable", "tag"),
    text("h3", u.name),
    text("p", u.description),
    text("p", u.size, "muted"),
    text("p", money(u.price) + " rental", "price"),
  );
  if (choose) {
    const btn = text("button", "Choose " + u.name);
    btn.type = "button";
    btn.addEventListener("click", () => choose(u, c));
    b.append(btn);
  } else {
    const a = text("a", "Request this inflatable", "button");
    a.href = "book.html?unit=" + encodeURIComponent(u.id);
    b.append(a);
  }
  c.append(b);
  return c;
}
setupMenu();
const page = document.body.dataset.page;
async function init() {
  if (page === "index") {
    const featured = await api.listUnits();
    $("featured").replaceChildren();
    for (const u of featured.slice(0, 3)) $("featured").append(unitCard(u));
    if (!$("featured").children.length)
      $("featured").textContent = "New inflatables are on the way. Call us to discuss your event.";
  }
  if (page === "contact") {
    const form = $("contact-form");
    let busy = false;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (busy || !validate(form)) return;
      busy = true;
      const btn = form.querySelector("button");
      btn.disabled = true;
      btn.textContent = "Saving…";
      try {
        await api.sendContactMessage(Object.fromEntries(new FormData(form)));
        $("contact-status").textContent =
          "Demo message saved. No email was sent. Please call or email the business for a real inquiry.";
        form.reset();
      } catch (err) {
        $("contact-status").textContent = err.message;
      } finally {
        window.turnstile?.reset();
        busy = false;
        btn.disabled = false;
        btn.textContent = "Send message";
      }
    });
  }
  if (page === "book") await booking();
}
async function booking() {
  const units = await api.listUnits();
  let unit,
    blocked = [],
    month = new Date();
  month.setDate(1);
  let quote = null,
    quotedAddress = "",
    version = 0,
    busy = false,
    loading = false,
    idempotency = crypto.randomUUID();
  const form = $("booking-form"),
    submit = $("send-request"),
    address = $("delivery_address");
  function totals() {
    if (!unit) return;
    $("chosen-name").textContent = unit.name;
    $("unit-price").textContent = money(unit.price);
    $("delivery-price").textContent = quote
      ? quote.status === "outside_area"
        ? "Outside delivery area"
        : money(quote.fee)
      : "Enter address";
    $("total-price").textContent =
      quote?.status === "outside_area" ? "Unavailable" : money(unit.price + (quote?.fee || 0));
    submit.disabled =
      busy ||
      loading ||
      !quote ||
      quote.status === "outside_area" ||
      address.value.trim() !== quotedAddress;
  }
  function drawCalendar() {
    const root = $("calendar");
    root.replaceChildren();
    const head = text("div", "", "calendar-head");
    const prev = text("button", "Previous");
    prev.type = "button";
    prev.setAttribute("aria-label", "Previous month");
    const next = text("button", "Next");
    next.type = "button";
    next.setAttribute("aria-label", "Next month");
    const label = text(
      "strong",
      month.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    );
    const today = new Date();
    prev.disabled =
      month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth();
    prev.onclick = () => {
      month.setMonth(month.getMonth() - 1);
      drawCalendar();
    };
    next.onclick = () => {
      month.setMonth(month.getMonth() + 1);
      drawCalendar();
    };
    head.append(prev, label, next);
    root.append(head);
    const days = text("div", "", "days");
    ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach((d) => days.append(text("span", d)));
    for (let i = 0; i < month.getDay(); i++) days.append(text("span", ""));
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    for (let n = 1; n <= count; n++) {
      const d = new Date(month.getFullYear(), month.getMonth(), n),
        iso = api.localDate(d);
      const btn = text("button", String(n));
      btn.type = "button";
      btn.disabled = iso < api.localDate() || blocked.includes(iso);
      btn.setAttribute("aria-pressed", String($("date").value === iso));
      btn.setAttribute(
        "aria-label",
        d.toLocaleDateString("en-US", { dateStyle: "full" }) +
          (btn.disabled ? ", unavailable" : ""),
      );
      btn.onclick = () => {
        $("date").value = iso;
        $("date-error").textContent = "";
        drawCalendar();
        root.querySelector(`[aria-pressed="true"]`).focus();
      };
      days.append(btn);
    }
    root.append(days);
  }
  let selectionVersion = 0;
  async function choose(u, c) {
    const ticket = ++selectionVersion;
    unit = u;
    $("date").value = "";
    $("date-error").textContent = "";
    $("booking").hidden = false;
    $("deposit").hidden = !u.deposit_required;
    document
      .querySelectorAll("#units .card")
      .forEach((card) => card.classList.toggle("selected", card === c));
    $("calendar").textContent = "Loading available dates…";
    loading = true;
    totals();
    try {
      const dates = await api.getBlockedDates(u.id);
      if (ticket !== selectionVersion) return;
      blocked = dates;
      month = new Date();
      month.setDate(1);
      drawCalendar();
      $("booking").scrollIntoView({ behavior: "auto", block: "start" });
    } catch (e) {
      $("calendar").textContent = e.message;
    } finally {
      if (ticket === selectionVersion) {
        loading = false;
        totals();
      }
    }
  }
  $("units").replaceChildren();
  for (const u of units) $("units").append(unitCard(u, choose));
  if (!units.length)
    $("units").textContent =
      "No inflatables are listed yet. Please call or email to discuss your event.";
  const chosen = new URLSearchParams(location.search).get("unit");
  if (chosen) {
    const i = units.findIndex((u) => u.id === chosen);
    if (i >= 0) await choose(units[i], $("units").children[i]);
  }
  let timer;
  address.addEventListener("input", () => {
    clearTimeout(timer);
    version++;
    quote = null;
    quotedAddress = "";
    $("outside").hidden = true;
    $("quote-status").textContent = "";
    totals();
    timer = setTimeout(fetchQuote, 500);
  });
  address.addEventListener("blur", () => {
    clearTimeout(timer);
    fetchQuote();
  });
  async function fetchQuote() {
    const addr = address.value.trim();
    if (addr.length < 5) return;
    const ticket = ++version;
    quote = null;
    $("quote-status").textContent = "Checking delivery estimate…";
    totals();
    try {
      const q = await api.getDeliveryQuote(addr);
      if (ticket !== version) return;
      quote = q;
      quotedAddress = addr;
      $("outside").hidden = q.status !== "outside_area";
      $("quote-status").textContent =
        q.status === "outside_area"
          ? ""
          : `Demo estimate: ${q.distance_miles} fictional miles · ${q.status === "free" ? "free delivery" : money(q.fee) + " delivery"}. Final delivery is confirmed by the owner.`;
    } catch (e) {
      if (ticket === version) $("quote-status").textContent = e.message;
    } finally {
      if (ticket === version) totals();
    }
  }
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy) return;
    const valid = validate(form);
    if (!$("date").value) {
      $("date-error").textContent = "Choose an available date.";
      if (valid) $("calendar").querySelector("button:not(:disabled)")?.focus();
    }
    if (!valid || !$("date").value) return;
    if (!quote || quote.status === "outside_area" || address.value.trim() !== quotedAddress) {
      $("booking-status").textContent =
        "Wait for an eligible delivery estimate before sending your request.";
      return;
    }
    busy = true;
    totals();
    submit.textContent = "Saving request…";
    try {
      const r = await api.createBookingRequest({
        ...Object.fromEntries(new FormData(form)),
        unit_id: unit.id,
        idempotency_key: idempotency,
      });
      $("booking").hidden = true;
      $("units").closest("section").hidden = true;
      $("confirmation").hidden = false;
      $("request-reference").textContent = "Demo reference: " + r.id;
      $("confirmation").focus();
    } catch (err) {
      $("booking-status").textContent = err.message;
      blocked = await api.getBlockedDates(unit.id);
      if (blocked.includes($("date").value)) $("date").value = "";
      drawCalendar();
    } finally {
      window.turnstile?.reset();
      busy = false;
      submit.textContent = "Send Booking Request";
      totals();
    }
  });
  window.addEventListener("storage", () => location.reload());
}
init().catch((e) => {
  const target = $("units") || $("featured") || $("contact-status");
  if (target) target.textContent = e.message;
});
