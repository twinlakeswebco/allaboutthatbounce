import * as api from "./api.js";
import { $, money, text, validate } from "./app.js";
let units = [],
  editingPhotos = [];
const report = (id, msg) => ($(id).textContent = msg);
async function run(id, fn) {
  try {
    await fn();
  } catch (e) {
    report(id, e.message);
  }
}
async function refresh() {
  units = await api.listUnits();
  const requests = await api.listBookingRequests();
  $("pending").replaceChildren();
  $("history").replaceChildren();
  for (const r of requests) {
    const box = text("article", "", "policy");
    box.append(
      text("h3", r.unit_name + " · " + r.date),
      text("p", r.name + " · " + r.event_type),
      text("p", r.delivery_address),
      text("p", `${money(r.total)} estimated · ${r.status}`),
    );
    const a = text("a", r.phone);
    a.href = "tel:" + r.phone.replace(/[^+\d]/g, "");
    const b = text("a", r.email);
    b.href = "mailto:" + encodeURIComponent(r.email);
    box.append(a, text("span", " · "), b);
    if (r.status === "pending") {
      const actions = text("div", "", "actions");
      for (const [status, label] of [
        ["confirmed", "Confirm request"],
        ["declined", "Decline request"],
      ]) {
        const btn = text("button", label, status === "declined" ? "danger" : "");
        btn.onclick = () =>
          run("admin-status", async () => {
            if (
              !confirm(
                `${label} for ${r.unit_name} on ${r.date}?${status === "confirmed" ? " This will make the date unavailable." : ""}`,
              )
            )
              return;
            btn.disabled = true;
            try {
              await api.setBookingStatus(r.id, status);
              await refresh();
              report(
                "admin-status",
                `Request ${status}. Demo only; contact the customer yourself.`,
              );
            } finally {
              btn.disabled = false;
            }
          });
        actions.append(btn);
      }
      box.append(actions);
      $("pending").append(box);
    } else $("history").append(box);
  }
  if (!$("pending").children.length)
    $("pending").append(text("p", "No pending requests. You’re all caught up.", "empty"));
  if (!$("history").children.length) $("history").append(text("p", "No past decisions yet."));
  $("unit-list").replaceChildren();
  const selected = $("calendar-unit").value;
  $("calendar-unit").replaceChildren();
  for (const u of units) {
    const row = text("div", "", "admin-unit");
    row.append(text("strong", u.name + " · " + money(u.price)));
    const actions = text("div", "", "actions");
    const edit = text("button", "Edit", "quiet");
    edit.onclick = () => editUnit(u);
    const remove = text("button", "Remove", "danger");
    remove.onclick = () =>
      run("admin-status", async () => {
        if (!confirm(`Remove ${u.name}? This cannot be undone.`)) return;
        await api.deleteUnit(u.id);
        await refresh();
        report("admin-status", "Inflatable removed.");
      });
    actions.append(edit, remove);
    row.append(actions);
    $("unit-list").append(row);
    const opt = text("option", u.name);
    opt.value = u.id;
    $("calendar-unit").append(opt);
  }
  if (units.some((u) => u.id === selected)) $("calendar-unit").value = selected;
  if (!units.length)
    $("unit-list").append(text("p", "No inflatables yet. Add your first one below."));
  await refreshDates();
}
async function refreshDates() {
  const id = $("calendar-unit").value;
  $("blocked-list").replaceChildren();
  if (!id) {
    $("blocked-list").textContent = "Add an inflatable first.";
    return;
  }
  const dates = await api.getBlockedDates(id);
  const requests = await api.listBookingRequests();
  for (const date of dates) {
    $("blocked-list").append(
      text(
        "p",
        date +
          (requests.some((r) => r.unit_id === id && r.date === date && r.status === "confirmed")
            ? " · confirmed rental"
            : " · manually blocked"),
      ),
    );
  }
  if (!dates.length) $("blocked-list").textContent = "No blocked dates for this inflatable.";
}
function editUnit(u) {
  const form = $("unit-form");
  form.reset();
  report("unit-status", "");
  form.querySelectorAll("[aria-invalid]").forEach((e) => e.removeAttribute("aria-invalid"));
  form.querySelectorAll(".error").forEach((e) => (e.textContent = ""));
  for (const key of ["id", "name", "description", "size", "mode", "price"])
    form.elements.namedItem(key).value = u?.[key] ?? (key === "mode" ? "dry" : "");
  form.elements.deposit_required.checked = u?.deposit_required || false;
  editingPhotos = u?.photos || [];
  $("unit-heading").textContent = u ? "Edit inflatable" : "Add inflatable";
  form.hidden = false;
  $("unit-name").focus();
}
$("add-unit").onclick = () => editUnit();
$("cancel-unit").onclick = () => {
  $("unit-form").hidden = true;
  $("add-unit").focus();
};
$("unit-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  if (!validate(form)) return;
  run("unit-status", async () => {
    const btn = form.querySelector("[type=submit]");
    if (btn.disabled) return;
    btn.disabled = true;
    try {
      const files = [...$("unit-photos").files];
      if (
        files.length > 3 ||
        files.some(
          (f) => f.size > 500 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(f.type),
        )
      )
        throw new Error("Choose up to 3 JPEG, PNG, or WebP photos, each under 500 KB.");
      let photos = $("remove-photos").checked ? [] : editingPhotos;
      if (files.length)
        photos = await Promise.all(
          files.map(
            (file) =>
              new Promise((resolve, reject) => {
                const r = new FileReader();
                r.onload = () => resolve(r.result);
                r.onerror = () => reject(new Error("Photo could not be read."));
                r.readAsDataURL(file);
              }),
          ),
        );
      const data = Object.fromEntries(new FormData(form));
      await api.saveUnit({
        id: data.id || undefined,
        name: data.name.trim(),
        description: data.description.trim(),
        size: data.size.trim(),
        mode: data.mode,
        price: Number(data.price),
        photos,
        deposit_required: form.elements.deposit_required.checked,
      });
      form.hidden = true;
      await refresh();
      report("admin-status", "Inflatable saved.");
      $("add-unit").focus();
    } finally {
      btn.disabled = false;
    }
  });
});
$("settings-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  if (!validate(form)) return;
  run("settings-status", async () => {
    const data = Object.fromEntries(new FormData(form));
    await api.updateSettings(
      Object.fromEntries(
        Object.entries(data).map(([k, v]) => [
          k,
          k === "max_delivery_miles" && v === "" ? null : Number(v),
        ]),
      ),
    );
    report("settings-status", "Delivery settings saved.");
  });
});
$("dates-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  if (!validate(form)) return;
  run("dates-status", async () => {
    const data = Object.fromEntries(new FormData(form));
    if (e.submitter.value === "unblock") {
      if (!confirm(`Unblock ${data.date}? Customers will be able to request this date.`)) return;
      await api.unblockDate(data.unit_id, data.date);
    } else await api.blockDate(data.unit_id, data.date);
    await refreshDates();
    report("dates-status", "Calendar updated.");
  });
});
$("calendar-unit").addEventListener("change", () => run("dates-status", refreshDates));
$("block-date").min = api.localDate();
run("admin-status", async () => {
  await refresh();
  const settings = await api.getSettings();
  for (const [k, v] of Object.entries(settings))
    $("settings-form").elements.namedItem(k).value = v ?? "";
});
window.addEventListener("storage", () => run("admin-status", refresh));
