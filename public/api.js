// Replace these async functions with fetch calls. No page knows the storage mechanism.
const KEY = "aatb-demo-v1";
export const defaultSettings = {
  free_radius_miles: 15,
  per_mile_rate: 0.35,
  trip_multiplier: 4,
  max_delivery_miles: null,
};
const seeds = [
  {
    id: "rainbow",
    name: "Rainbow Bounce",
    description:
      "A colorful classic for a day of jumping. Placeholder inventory.",
    size: "15 × 15 ft · capacity pending",
    mode: "dry",
    price: 175,
    photos: ["placeholder.svg"],
    deposit_required: false,
  },
  {
    id: "splash",
    name: "Splash & Slide",
    description: "A slide made for sunny-day fun. Placeholder inventory.",
    size: "20 × 12 ft · capacity pending",
    mode: "wet",
    price: 250,
    photos: ["placeholder.svg"],
    deposit_required: false,
  },
  {
    id: "party",
    name: "Big Party Combo",
    description:
      "Bounce and slide in one big adventure. Placeholder inventory.",
    size: "25 × 15 ft · capacity pending",
    mode: "dry",
    price: 325,
    photos: ["placeholder.svg"],
    deposit_required: false,
  },
];
function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw
      ? JSON.parse(raw)
      : {
          units: seeds,
          settings: defaultSettings,
          blocks: {},
          requests: [],
          messages: [],
        };
  } catch {
    throw new Error(
      "Demo storage is unavailable. Enable browser storage and try again.",
    );
  }
}
function write(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    throw new Error(
      "Could not save. Browser storage may be full; use smaller photos and try again.",
    );
  }
}
async function mutate(fn) {
  const run = () => {
    const s = read();
    const result = fn(s);
    write(s);
    return structuredClone(result);
  };
  return navigator.locks ? navigator.locks.request(KEY, run) : run();
}
const copy = (x) => structuredClone(x);
export async function listUnits() {
  return copy(read().units);
}
export async function getSettings() {
  return copy(read().settings);
}
export async function updateSettings(settings) {
  for (const k of ["free_radius_miles", "per_mile_rate", "trip_multiplier"])
    if (
      !Number.isFinite(settings[k]) ||
      settings[k] < 0 ||
      (k === "trip_multiplier" && settings[k] === 0)
    )
      throw new Error("Enter valid delivery settings.");
  if (
    settings.max_delivery_miles !== null &&
    (!Number.isFinite(settings.max_delivery_miles) ||
      settings.max_delivery_miles < 0)
  )
    throw new Error("Maximum distance must be blank or nonnegative.");
  return mutate((s) => (s.settings = copy(settings)));
}
function blocked(s, id) {
  return [
    ...new Set([
      ...(s.blocks[id] || []),
      ...s.requests
        .filter((r) => r.unit_id === id && r.status === "confirmed")
        .map((r) => r.date),
    ]),
  ].sort();
}
export async function getBlockedDates(unitId) {
  return blocked(read(), unitId);
}
function quote(address, settings) {
  if (typeof address !== "string" || address.trim().length < 5)
    throw new Error("Enter your complete delivery address.");
  // DEMO ONLY: "demo 15 miles", "demo 16 miles", "demo 20 miles" override the fictional distance.
  // Real distance is calculated by the backend from a private origin in server configuration.
  const override = address.match(/demo\s+(\d+(?:\.\d+)?)\s+miles/i);
  const distance_miles = override
    ? Number(override[1])
    : 10 +
      ([...address.toLowerCase()].reduce((n, c) => n + c.charCodeAt(0), 0) %
        26);
  const outside =
    settings.max_delivery_miles !== null &&
    distance_miles > settings.max_delivery_miles;
  const fee =
    distance_miles <= settings.free_radius_miles
      ? 0
      : Math.round(
          distance_miles *
            settings.per_mile_rate *
            settings.trip_multiplier *
            100,
        ) / 100;
  return {
    distance_miles,
    fee: outside ? 0 : fee,
    status: outside ? "outside_area" : fee === 0 ? "free" : "fee",
  };
}
export async function getDeliveryQuote(address) {
  return quote(address, read().settings);
}
export async function createBookingRequest(input) {
  return mutate((s) => {
    const existing = s.requests.find(
      (r) => r.idempotency_key === input.idempotency_key,
    );
    if (existing) return existing;
    const unit = s.units.find((u) => u.id === input.unit_id);
    if (!unit || blocked(s, unit.id).includes(input.date))
      throw new Error(
        "That inflatable or date is no longer available. Choose another date.",
      );
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || input.date < localDate())
      throw new Error("Choose an upcoming date.");
    for (const k of [
      "name",
      "phone",
      "email",
      "event_type",
      "delivery_address",
      "idempotency_key",
    ])
      if (!String(input[k] || "").trim())
        throw new Error("Complete every required field.");
    const q = quote(input.delivery_address, s.settings);
    if (q.status === "outside_area")
      throw new Error(
        "This address is outside the delivery area. Please call or email.",
      );
    const r = {
      ...input,
      id: crypto.randomUUID(),
      status: "pending",
      created_at: new Date().toISOString(),
      unit_name: unit.name,
      unit_price: unit.price,
      delivery_quote: q,
      total: Math.round((unit.price + q.fee) * 100) / 100,
    };
    s.requests.push(r);
    return r;
  });
}
export function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export async function listBookingRequests() {
  return copy(read().requests);
}
export async function setBookingStatus(id, status) {
  return mutate((s) => {
    if (!["confirmed", "declined"].includes(status))
      throw new Error("Invalid status.");
    const r = s.requests.find((r) => r.id === id);
    if (!r || r.status !== "pending")
      throw new Error("This request is no longer pending. Refresh the list.");
    if (
      status === "confirmed" &&
      (!s.units.some((u) => u.id === r.unit_id) ||
        blocked(s, r.unit_id).includes(r.date))
    )
      throw new Error(
        "That unit or date is unavailable. Resolve the calendar conflict first.",
      );
    r.status = status;
    return r;
  });
}
export async function saveUnit(unit) {
  return mutate((s) => {
    if (
      !unit.name?.trim() ||
      !unit.description?.trim() ||
      !unit.size?.trim() ||
      !["dry", "wet"].includes(unit.mode) ||
      !Number.isFinite(unit.price) ||
      unit.price < 0
    )
      throw new Error("Complete all inflatable details with a valid price.");
    const item = {
      ...unit,
      id: unit.id || crypto.randomUUID(),
      deposit_required: !!unit.deposit_required,
      photos: unit.photos?.length ? unit.photos : ["placeholder.svg"],
    };
    const i = s.units.findIndex((u) => u.id === item.id);
    if (i < 0) s.units.push(item);
    else s.units[i] = item;
    return item;
  });
}
export async function deleteUnit(id) {
  return mutate((s) => {
    if (
      s.requests.some(
        (r) => r.unit_id === id && ["pending", "confirmed"].includes(r.status),
      )
    )
      throw new Error(
        "This inflatable has pending or confirmed requests. Keep it until those requests are resolved.",
      );
    s.units = s.units.filter((u) => u.id !== id);
    delete s.blocks[id];
    return { deleted: true };
  });
}
export async function blockDate(unitId, date) {
  return mutate((s) => {
    if (
      !s.units.some((u) => u.id === unitId) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date)
    )
      throw new Error("Choose a unit and date.");
    s.blocks[unitId] = [...new Set([...(s.blocks[unitId] || []), date])];
    return { unit_id: unitId, date, blocked: true };
  });
}
export async function unblockDate(unitId, date) {
  return mutate((s) => {
    if (
      s.requests.some(
        (r) =>
          r.unit_id === unitId && r.date === date && r.status === "confirmed",
      )
    )
      throw new Error(
        "A confirmed rental uses this date; it cannot be unblocked here.",
      );
    s.blocks[unitId] = (s.blocks[unitId] || []).filter((d) => d !== date);
    return { unit_id: unitId, date, blocked: false };
  });
}
// Future POST /api/contact; demo does not send email.
export async function sendContactMessage(input) {
  return mutate((s) => {
    if (!input.name?.trim() || !input.email?.trim() || !input.message?.trim())
      throw new Error("Complete every field.");
    const r = {
      ...input,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };
    s.messages.push(r);
    return { id: r.id, status: "received" };
  });
}
