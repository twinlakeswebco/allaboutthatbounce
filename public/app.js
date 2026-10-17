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
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function fieldMessage(el) {
  const value = el.value.trim();
  if (el.required && value === "") return "Please complete this field.";
  if (el.type === "tel" && value && value.replace(/\D/g, "").length < 10)
    return "Enter a phone number with at least 10 digits.";
  if (el.type === "email" && value && (el.validity.typeMismatch || !emailPattern.test(value)))
    return "Enter a valid email address, like name@example.com.";
  if (el.id === "zip" && value && !/^\d{5}(-\d{4})?$/.test(value))
    return "Enter a 5-digit ZIP code.";
  if (el.minLength > 0 && value && value.length < el.minLength)
    return `Enter at least ${el.minLength} characters.`;
  if (!el.validity.valid && !el.validity.valueMissing && !el.validity.typeMismatch)
    return "Enter a valid value within the allowed range.";
  return "";
}
export function checkField(el) {
  const message = fieldMessage(el);
  const err = $(el.id + "-error");
  if (err) err.textContent = message;
  el.setAttribute("aria-invalid", String(!!message));
  return message;
}
export function validate(form) {
  let first;
  for (const el of form.querySelectorAll("input:not([type=hidden]),select,textarea")) {
    if (el.disabled || !el.id) continue;
    if (checkField(el) && !first) first = el;
  }
  if (first) first.focus();
  return !first;
}
export function safePhoto(src) {
  return typeof src === "string" &&
    (src === "placeholder.svg" ||
      /^\/media\/[A-Za-z0-9_-]+$/.test(src) ||
      /^assets\/[a-zA-Z0-9_-]+\.(?:png|jpe?g|webp)$/.test(src) ||
      /^data:image\/(jpeg|png|webp);base64,/.test(src) ||
      /^https:\/\//.test(src))
    ? src
    : "placeholder.svg";
}
export function unitCard(u, choose) {
  const c = text("article", "", "card");
  const img = document.createElement("img");
  const src = safePhoto(u.photos[0]);
  img.src = src;
  img.alt = src === "placeholder.svg" ? `Photo of ${u.name} coming soon` : `${u.name} inflatable`;
  img.width = 800;
  img.height = 600;
  img.loading = "lazy";
  img.addEventListener(
    "error",
    () => {
      img.src = "placeholder.svg";
      img.alt = `Photo of ${u.name} coming soon`;
    },
    { once: true },
  );
  c.append(img);
  const b = text("div", "", "card-body");
  b.append(
    text("span", u.mode === "wet" ? "Water fun" : "Dry fun", "tag"),
    text("h3", u.name),
    text("p", u.description),
    text("p", u.size, "muted"),
    text("p", "Starting at " + money(u.price), "price"),
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
const unavailableMessage =
  "This service is unavailable right now. Please call 502-851-7596 for help.";
// The Worker decides what "today" is, in America/New_York; use its clock, not the device's.
const kentuckyToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(api.serverNow());
const currentMonth = () => {
  const [y, m] = kentuckyToday().split("-").map(Number);
  return new Date(y, m - 1, 1);
};
function longDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
function unitImage(src, name, index, total) {
  const img = document.createElement("img");
  const safe = safePhoto(src);
  const soon = `Photo of ${name} coming soon`;
  img.src = safe;
  img.alt =
    safe === "placeholder.svg"
      ? soon
      : total > 1
        ? `${name}, photo ${index + 1} of ${total}`
        : `${name} inflatable`;
  img.width = 800;
  img.height = 600;
  img.loading = "lazy";
  img.addEventListener(
    "error",
    () => {
      img.src = "placeholder.svg";
      img.alt = soon;
    },
    { once: true },
  );
  return img;
}
export function bookingCard(u, choose) {
  const c = text("article", "", "card pick");
  const photos = Array.isArray(u.photos) && u.photos.length ? u.photos : [null];
  const strip = text("div", "", "photos");
  photos.forEach((p, i) => strip.append(unitImage(p, u.name, i, photos.length)));
  if (photos.length > 1) {
    strip.tabIndex = 0;
    strip.setAttribute("role", "group");
    strip.setAttribute("aria-label", `${photos.length} photos of ${u.name}`);
  }
  c.append(strip);
  const b = text("div", "", "card-body");
  const price = text("p", money(u.price), "price");
  price.append(text("span", " for your event day", "per"));
  const specs = text("dl", "", "specs");
  for (const [k, v] of [
    ["Specs", u.size],
    ["Use", u.mode === "wet" ? "Wet (used with water)" : "Dry (no water)"],
  ]) {
    const row = text("div", "");
    row.append(text("dt", k), text("dd", v));
    specs.append(row);
  }
  b.append(
    text("span", u.mode === "wet" ? "Wet" : "Dry", "tag"),
    text("h3", u.name),
    text("p", u.description),
    specs,
  );
  if (photos.length > 1) b.append(text("p", "Scroll sideways on the photo to see more.", "muted"));
  b.append(price);
  const btn = text("button", "Choose " + u.name, "pick-btn");
  btn.type = "button";
  btn.setAttribute("aria-pressed", "false");
  btn.addEventListener("click", () => choose(u, c));
  b.append(btn);
  c.append(b);
  return c;
}
// Turnstile is rendered explicitly so a very narrow screen gets the documented compact widget
// (150px wide); the normal widget is 300px wide and cannot fit a 320px screen.
function mountTurnstile() {
  const slots = document.querySelectorAll(".turnstile-slot");
  if (!slots.length) return;
  const render = () => {
    if (typeof window.turnstile?.render !== "function") return;
    for (const slot of slots) {
      if (slot.dataset.mounted) continue;
      slot.dataset.mounted = "true";
      window.turnstile.render(slot, {
        sitekey: slot.dataset.sitekey,
        action: slot.dataset.action,
        size: window.innerWidth < 340 ? "compact" : "normal",
      });
    }
  };
  if (window.turnstile) render();
  else
    document
      .querySelector('script[src*="challenges.cloudflare.com"]')
      ?.addEventListener("load", render);
}
setupMenu();
mountTurnstile();
const page = document.body.dataset.page;
async function init() {
  if (page === "index") {
    const featured = await api.listUnits();
    $("featured").replaceChildren();
    for (const u of featured.slice(0, 3)) $("featured").append(unitCard(u));
    if (!$("featured").children.length)
      $("featured").textContent =
        "New inflatables are on the way. Call 502-851-7596 to talk through your event.";
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
      btn.textContent = "Sending…";
      try {
        await api.sendContactMessage(Object.fromEntries(new FormData(form)));
        $("contact-status").textContent =
          "Message sent. We'll get back to you soon. Need an answer sooner? Call 502-851-7596.";
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
function row(label, value) {
  const r = text("div", "");
  r.append(text("dt", label), text("dd", value));
  return r;
}
const validQuote = (q) =>
  ["free", "fee", "outside_area"].includes(q?.status) &&
  Number.isFinite(q.fee) &&
  Number.isFinite(q.distance_miles);
async function booking() {
  const form = $("booking-form"),
    submit = $("send-request"),
    deliveryAddress = $("delivery_address"),
    addressFields = ["street", "city", "zip"].map($),
    checkBtn = $("check-delivery");
  let unit = null,
    blocked = [],
    datesState = "idle",
    datesError = "",
    month = currentMonth(),
    selectionVersion = 0;
  let quote = null,
    quotedAddress = "",
    quoteError = "",
    quoteHint = "",
    quoting = null,
    quotingAddress = "",
    quoteVersion = 0,
    freeMiles = null;
  let busy = false,
    idempotency = crypto.randomUUID(),
    lastSignature = "";

  // The Worker takes one address string; the form collects it in autofill-friendly parts.
  const partialAddress = () => {
    const [street, city, zip] = addressFields.map((f) => f.value.trim());
    return [street, city, zip && "KY " + zip].filter(Boolean).join(", ");
  };
  const currentAddress = () => {
    const [street, city, zip] = addressFields.map((f) => f.value.trim());
    return street && city && /^\d{5}(-\d{4})?$/.test(zip) ? `${street}, ${city}, KY ${zip}` : "";
  };
  function setStatus(message, kind = "") {
    const s = $("booking-status");
    s.textContent = message;
    s.className = "status" + (kind ? " " + kind : "");
  }
  function renderQuote() {
    const status = $("quote-status");
    status.className = "status";
    const checking = quoting !== null;
    $("outside").hidden = quote?.status !== "outside_area";
    checkBtn.disabled = checking;
    checkBtn.textContent = checking ? "Checking…" : quote ? "Check again" : "Check delivery price";
    status.setAttribute("aria-busy", String(checking));
    let delivery = "Add address",
      total = "—",
      note = "Add your delivery address and check the price to see your estimated total.";
    if (checking) {
      status.textContent = "Checking delivery to that address…";
      delivery = "Checking…";
      note = "Checking your delivery price…";
    } else if (quoteError) {
      status.textContent = quoteError;
      status.classList.add("error");
      delivery = "Not checked";
      note = "Check your delivery price to see your estimated total.";
    } else if (quote?.status === "outside_area") {
      status.textContent = "";
      delivery = "Outside our area";
      note = "We can’t price delivery to this address online. Please call or email Rena.";
    } else if (quote) {
      const miles = `About ${quote.distance_miles} driving miles away`;
      const totalText = unit ? ` Estimated total: ${money(unit.price + quote.fee)}.` : "";
      status.textContent =
        (quote.status === "free"
          ? `${miles}, so delivery is free.`
          : `${miles}, past our ${freeMiles ? freeMiles + "-mile " : ""}free delivery zone, so delivery is ${money(quote.fee)}.`) +
        totalText +
        " Rena confirms your address is in our service area and the final details.";
      status.classList.add("ok");
      delivery = quote.status === "free" ? "Free" : money(quote.fee);
      total = unit ? money(unit.price + quote.fee) : "—";
      note = "Estimated total is the rental price plus delivery. Rena confirms the final total.";
    } else {
      status.textContent = quoteHint;
      if (quoteHint) status.classList.add("warn");
    }
    $("delivery-price").textContent = delivery;
    $("total-price").textContent = total;
    $("total-note").textContent = note;
  }
  function renderSummary() {
    if (!unit) return;
    const val = (id) => form.elements.namedItem(id).value.trim();
    $("chosen-name").textContent = unit.name;
    $("unit-price").textContent = money(unit.price);
    const set = (id, v, empty) => {
      const e = $(id);
      e.textContent = v || empty;
      e.classList.toggle("blank", !v);
    };
    set("sum-date", $("date").value && longDate($("date").value), "Choose a date");
    set("sum-name", val("name"), "Not added yet");
    set("sum-phone", val("phone"), "Not added yet");
    set("sum-email", val("email"), "Not added yet");
    set("sum-event", val("event_type"), "Not chosen yet");
    set("sum-address", partialAddress(), "Not added yet");
    renderQuote();
    submit.disabled = busy || datesState === "loading";
  }
  function setDate(iso) {
    $("date").value = iso;
    $("date-error").textContent = "";
    $("date-readout").textContent = iso
      ? "Requested date: " + longDate(iso)
      : "No date chosen yet.";
    renderSummary();
  }
  function focusCalendar() {
    const t = $("calendar").querySelector('.days button[tabindex="0"]');
    (t || $("calendar").querySelector("button"))?.focus();
  }
  function drawCalendar() {
    const root = $("calendar");
    root.replaceChildren();
    root.setAttribute("aria-busy", String(datesState === "loading"));
    if (datesState === "loading") {
      root.append(text("p", "Loading available dates…", "status"));
      return;
    }
    if (datesState === "error") {
      root.append(text("p", datesError, "status error"));
      const retry = text("button", "Try again");
      retry.type = "button";
      retry.addEventListener("click", () => loadDates());
      root.append(retry);
      return;
    }
    const head = text("div", "", "calendar-head");
    const prev = text("button", "Previous");
    prev.type = "button";
    prev.dataset.nav = "prev";
    prev.setAttribute("aria-label", "Previous month");
    const next = text("button", "Next");
    next.type = "button";
    next.dataset.nav = "next";
    next.setAttribute("aria-label", "Next month");
    const label = text(
      "strong",
      month.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    );
    label.setAttribute("aria-live", "polite");
    const thisMonth = currentMonth();
    prev.disabled =
      month.getFullYear() === thisMonth.getFullYear() && month.getMonth() === thisMonth.getMonth();
    const go = (delta, nav) => () => {
      month = new Date(month.getFullYear(), month.getMonth() + delta, 1);
      drawCalendar();
      const target = root.querySelector(`[data-nav="${nav}"]:not(:disabled)`);
      (target || root.querySelector("[data-nav]:not(:disabled)"))?.focus();
    };
    prev.onclick = go(-1, "prev");
    next.onclick = go(1, "next");
    head.append(prev, label, next);
    root.append(head);
    const days = text("div", "", "days");
    ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach((d) => {
      const s = text("span", d);
      s.setAttribute("aria-hidden", "true");
      days.append(s);
    });
    for (let i = 0; i < month.getDay(); i++) days.append(text("span", ""));
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const todayIso = kentuckyToday();
    const chosen = $("date").value;
    let tabStop = null;
    for (let n = 1; n <= count; n++) {
      const d = new Date(month.getFullYear(), month.getMonth(), n),
        iso = api.localDate(d);
      const isPast = iso < todayIso,
        isBlocked = blocked.includes(iso);
      const btn = text("button", String(n), isBlocked ? "taken" : isPast ? "past" : "");
      btn.type = "button";
      btn.dataset.day = String(n);
      btn.disabled = isPast || isBlocked;
      btn.tabIndex = -1;
      btn.setAttribute("aria-pressed", String(chosen === iso));
      btn.setAttribute(
        "aria-label",
        d.toLocaleDateString("en-US", { dateStyle: "full" }) +
          (isBlocked ? ", booked or unavailable" : isPast ? ", already passed" : ""),
      );
      btn.onclick = () => {
        setDate(iso);
        drawCalendar();
        focusCalendar();
      };
      if (chosen === iso && !btn.disabled) tabStop = btn;
      days.append(btn);
    }
    tabStop ||= days.querySelector("button:not(:disabled)");
    if (tabStop) tabStop.tabIndex = 0;
    days.addEventListener("keydown", (e) => {
      const here = e.target.closest?.("button");
      const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 }[e.key];
      if (!here || (step === undefined && e.key !== "Home" && e.key !== "End")) return;
      e.preventDefault();
      const open = [...days.querySelectorAll("button:not(:disabled)")];
      let to;
      if (e.key === "Home") to = open[0];
      else if (e.key === "End") to = open[open.length - 1];
      else {
        const want = Number(here.dataset.day) + step;
        to =
          step > 0
            ? open.find((b) => Number(b.dataset.day) >= want)
            : [...open].reverse().find((b) => Number(b.dataset.day) <= want);
      }
      if (!to) return;
      days.querySelectorAll("button").forEach((b) => (b.tabIndex = -1));
      to.tabIndex = 0;
      to.focus();
    });
    root.append(days);
  }
  async function loadDates() {
    const ticket = selectionVersion;
    datesState = "loading";
    drawCalendar();
    renderSummary();
    try {
      const dates = await api.getBlockedDates(unit.id);
      if (ticket !== selectionVersion) return;
      blocked = Array.isArray(dates) ? dates.filter((d) => typeof d === "string") : [];
      month = currentMonth();
      datesState = "ready";
    } catch (e) {
      if (ticket !== selectionVersion) return;
      datesState = "error";
      datesError = e.message;
    }
    drawCalendar();
    renderSummary();
  }
  async function choose(u, c) {
    ++selectionVersion;
    const hadDate = !!$("date").value;
    unit = u;
    blocked = [];
    $("date").value = "";
    $("date-readout").textContent = hadDate
      ? "You chose a different inflatable, so please pick your date again."
      : "No date chosen yet.";
    $("date-error").textContent = "";
    $("booking").hidden = false;
    $("deposit").hidden = !u.deposit_required;
    document.querySelectorAll("#units .card").forEach((card) => {
      const on = card === c;
      const btn = card.querySelector(".pick-btn");
      card.classList.toggle("selected", on);
      if (btn) {
        btn.setAttribute("aria-pressed", String(on));
        btn.textContent = on
          ? "Selected: " + card.querySelector("h3").textContent
          : "Choose " + card.querySelector("h3").textContent;
      }
    });
    setStatus("");
    $("booking").scrollIntoView({ behavior: "auto", block: "start" });
    $("date-title").focus({ preventScroll: true });
    await loadDates();
  }
  function invalidateQuote() {
    const had = quote !== null || quoting !== null;
    quoteVersion++;
    quote = null;
    quotedAddress = "";
    quoteError = "";
    quoting = null;
    quotingAddress = "";
    quoteHint = had
      ? "You changed the address, so the delivery price needs to be checked again."
      : "";
  }
  function fetchQuote() {
    const addr = currentAddress();
    if (!addr) return Promise.resolve(false);
    if (quote && quotedAddress === addr) return Promise.resolve(true);
    if (quoting && quotingAddress === addr) return quoting;
    const ticket = ++quoteVersion;
    quote = null;
    quotedAddress = "";
    quoteError = "";
    quoteHint = "";
    quotingAddress = addr;
    const run = (async () => {
      try {
        const q = await api.getDeliveryQuote(addr);
        if (ticket !== quoteVersion) return false;
        if (!validQuote(q))
          throw new Error(
            "We couldn’t read the delivery price. Please try again or call 502-851-7596.",
          );
        quote = q;
        quotedAddress = addr;
        return true;
      } catch (e) {
        if (ticket === quoteVersion) quoteError = e.message;
        return false;
      } finally {
        if (ticket === quoteVersion) {
          quoting = null;
          quotingAddress = "";
          renderSummary();
        }
      }
    })();
    quoting = run;
    renderSummary();
    return run;
  }
  function onAddressChange() {
    deliveryAddress.value = currentAddress();
    const now = currentAddress();
    const same = (quote && quotedAddress === now) || (quoting && quotingAddress === now);
    if (!same && (quote || quoting || quoteError)) invalidateQuote();
    renderSummary();
  }
  for (const field of addressFields) {
    field.addEventListener("input", onAddressChange);
    field.addEventListener("change", onAddressChange);
  }
  checkBtn.addEventListener("click", () => {
    let first;
    for (const field of addressFields) if (checkField(field) && !first) first = field;
    if (first) return first.focus();
    fetchQuote();
  });
  form.addEventListener("input", (e) => {
    const el = e.target;
    if (el.id && el.getAttribute("aria-invalid") === "true") checkField(el);
    renderSummary();
  });
  form.addEventListener("change", renderSummary);
  // Quoting is never started on blur: a status line appearing above the Send button while
  // a finger is on it can shift the button and swallow the tap.
  form.addEventListener("focusout", (e) => {
    const el = e.target;
    if (el.matches?.("input,select") && el.id && el.value.trim()) checkField(el);
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy || !unit) return;
    setStatus("");
    const fieldsOk = validate(form);
    const noDate = !$("date").value;
    if (noDate) {
      $("date-error").textContent = "Choose an available date.";
      focusCalendar();
    }
    if (!fieldsOk || noDate) {
      setStatus("Please fix the items marked above, then send your request again.", "error");
      return;
    }
    if (!quote || quotedAddress !== currentAddress()) {
      const ok = await fetchQuote();
      // The address changed while the price was loading; the quote area already says so.
      if (!ok && !quoteError && !quoting) return setStatus("");
      if (busy) return;
      setStatus(
        ok && quote?.status !== "outside_area"
          ? "Your delivery price is ready. Look over the total, then press Send rental request."
          : ok
            ? "We can’t take an online request for this address. Please call or email Rena."
            : "Your request has not been sent. We need a delivery price for your address first.",
        ok && quote?.status !== "outside_area" ? "ok" : "error",
      );
      return;
    }
    if (quote.status === "outside_area") {
      setStatus(
        "We can’t take an online request for this address. Please call or email Rena.",
        "error",
      );
      return;
    }
    const token = document.querySelector('[name="cf-turnstile-response"]')?.value;
    if (!token) {
      setStatus(
        window.turnstile
          ? "Please complete the security check above the Send button, then try again."
          : "The security check did not load. Refresh the page, or call Rena at 502-851-7596 to make your request.",
        "error",
      );
      return;
    }
    const fields = Object.fromEntries(new FormData(form));
    for (const part of ["street", "city", "zip"]) delete fields[part];
    const payload = { ...fields, delivery_address: quotedAddress, unit_id: unit.id };
    // A retry of the same request reuses its key; changed details get a new one.
    const signature = JSON.stringify(Object.entries({ ...payload, website: "" }).sort());
    if (signature !== lastSignature) idempotency = crypto.randomUUID();
    lastSignature = signature;
    busy = true;
    submit.textContent = "Sending…";
    renderSummary();
    try {
      const r = await api.createBookingRequest({ ...payload, idempotency_key: idempotency });
      showConfirmation(r, fields);
    } catch (err) {
      setStatus(
        err.outcomeUnknown
          ? "We couldn’t confirm that your request was received. Complete the security check and press Send again; if you change nothing, it won’t create a duplicate. Or call Rena at 502-851-7596 to check."
          : err.message,
        "error",
      );
      try {
        const dates = await api.getBlockedDates(unit.id);
        blocked = Array.isArray(dates) ? dates.filter((d) => typeof d === "string") : blocked;
        if (blocked.includes($("date").value)) {
          setDate("");
          $("date-error").textContent = "That date was just taken. Please choose another.";
        } else if ($("date").value && $("date").value < kentuckyToday()) {
          setDate("");
          $("date-error").textContent = "That date has passed. Please choose an upcoming date.";
        }
        drawCalendar();
      } catch {}
    } finally {
      window.turnstile?.reset();
      busy = false;
      submit.textContent = "Send rental request";
      renderSummary();
    }
  });
  function showConfirmation(r, fields) {
    const list = $("confirm-details");
    const money2 = (n) => (Number.isFinite(n) ? money(n) : null);
    const fee = r.delivery_quote?.fee;
    list.replaceChildren(
      row("Inflatable", r.unit_name || unit.name),
      row("Requested date", longDate(r.date || fields.date)),
      row("Delivery to", r.delivery_address || fields.delivery_address),
      row("Rental price", money2(r.unit_price) || money(unit.price)),
      row("Delivery", fee === 0 ? "Free" : money2(fee) || "Rena will confirm"),
      row("Estimated total", money2(r.total) || "Rena will confirm"),
    );
    $("confirm-email-note").textContent =
      `We’ve queued a receipt email to ${r.email || fields.email}.`;
    $("request-reference").textContent = "Request reference: " + r.id;
    $("booking-flow").hidden = true;
    $("confirmation").hidden = false;
    document.title = "Request received | All About That Bounce";
    $("confirm-title").focus();
    $("confirmation").scrollIntoView({ behavior: "auto", block: "start" });
  }
  async function loadUnits() {
    const box = $("units");
    box.setAttribute("aria-busy", "true");
    box.replaceChildren(text("p", "Loading inflatables…"));
    $("units-retry").hidden = true;
    let units;
    try {
      units = await api.listUnits();
      if (!Array.isArray(units)) throw new Error(unavailableMessage);
    } catch (e) {
      box.textContent = e.message;
      box.setAttribute("aria-busy", "false");
      $("units-retry").hidden = false;
      return;
    }
    box.setAttribute("aria-busy", "false");
    if (!units.length) {
      $("booking-flow").hidden = true;
      $("empty-state").hidden = false;
      $("page-lead").textContent =
        "Online requests aren’t open yet. Rena is glad to help by phone or email.";
      return;
    }
    box.replaceChildren(...units.map((u) => bookingCard(u, choose)));
    const wanted = new URLSearchParams(location.search).get("unit");
    if (wanted) {
      const i = units.findIndex((u) => u.id === wanted);
      if (i >= 0) await choose(units[i], box.children[i]);
      else {
        $("units-notice").textContent =
          "The inflatable you picked isn’t listed right now. Choose another one below.";
        $("units-notice").hidden = false;
      }
    }
  }
  $("retry-units").addEventListener("click", loadUnits);
  api
    .getSettings()
    .then((s) => {
      if (!Number.isFinite(s?.free_radius_miles)) return;
      freeMiles = s.free_radius_miles;
      $("delivery-policy").textContent =
        `Delivery is free within ${freeMiles} driving miles. Beyond that, the fee depends on distance.`;
      renderSummary();
    })
    .catch(() => {});
  await loadUnits();
}
init().catch((e) => {
  const target = $("units") || $("featured") || $("contact-status");
  if (target) target.textContent = e.message;
});
