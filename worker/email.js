import { escapeHtml, centsToDollars } from "./validation.js";
const money = (c) => `$${centsToDollars(c).toFixed(2)}`;
export function mailRow(kind, to, reply, subject, text, html) {
  return {
    id: crypto.randomUUID(),
    kind,
    to_email: to,
    reply_to: reply || null,
    subject,
    text,
    html,
  };
}
export function requestMails(r, env) {
  const admin = `New booking request\nUnit: ${r.unit_name}\nDate: ${r.event_date}\nCustomer: ${r.name}\nPhone: ${r.phone}\nEmail: ${r.email}\nDelivery address: ${r.delivery_address}\nDistance: ${r.distance_miles} miles\nDelivery fee: ${money(r.delivery_fee_cents)}\nTotal: ${money(r.total_cents)}\n${env.SITE_ORIGIN}/admin.html`;
  const safe = escapeHtml(admin).replace(/\n/g, "<br>");
  const customer = `Your request was received. Your date is NOT booked until the owner confirms it.\n\nUnit: ${r.unit_name}\nDate: ${r.event_date}\nEstimated total: ${money(r.total_cents)}\n\nPayment is cash or check.`;
  return [
    mailRow(
      "new_request",
      env.OWNER_EMAIL,
      r.email,
      `New booking request: ${r.unit_name} — ${r.event_date}`,
      admin,
      `<p>${safe}</p>`,
    ),
    mailRow(
      "request_received",
      r.email,
      null,
      "Booking request received",
      customer,
      `<p><strong>Your request was received. Your date is NOT booked until the owner confirms it.</strong></p><p>${escapeHtml(r.unit_name)} · ${escapeHtml(r.event_date)} · ${money(r.total_cents)}</p><p>Payment is cash or check.</p>`,
    ),
  ];
}
export function decisionMail(r, status) {
  const confirmed = status === "confirmed";
  const first = confirmed
    ? "Your booking is confirmed."
    : "We’re sorry, but we can’t confirm this booking request.";
  const text = confirmed
    ? `${first}\n\nDate: ${r.event_date}\nUnit: ${r.unit_name}\nTotal: ${money(r.total_cents)}\nPayment is cash or check.`
    : `${first}\n\nPlease call or email us to find another date.`;
  return mailRow(
    status,
    r.email,
    null,
    confirmed ? "Booking confirmed" : "Booking request update",
    text,
    `<p><strong>${escapeHtml(first)}</strong></p><p>${confirmed ? `${escapeHtml(r.event_date)} · ${escapeHtml(r.unit_name)} · ${money(r.total_cents)}<br>Payment is cash or check.` : "Please call or email us to find another date."}</p>`,
  );
}
export function contactMail(x, env) {
  const text = `Contact form message\nFrom: ${x.name}\nEmail: ${x.email}\n\n${x.message}`;
  return mailRow(
    "contact",
    env.OWNER_EMAIL,
    x.email,
    "Website contact message",
    text,
    `<p>From: ${escapeHtml(x.name)} &lt;${escapeHtml(x.email)}&gt;</p><p>${escapeHtml(x.message).replace(/\n/g, "<br>")}</p>`,
  );
}
export function outboxStatement(env, m) {
  return env.DB.prepare(
    "INSERT INTO notification_outbox(id,kind,to_email,reply_to,subject,html,text) VALUES(?,?,?,?,?,?,?)",
  ).bind(m.id, m.kind, m.to_email, m.reply_to, m.subject, m.html, m.text);
}
export async function sendOutbox(env, id, sender = sendResend) {
  const m = await env.DB.prepare(
    "SELECT * FROM notification_outbox WHERE id=? AND status!='sent' AND attempts<5",
  )
    .bind(id)
    .first();
  if (!m) return;
  try {
    await sender(env, m);
    await env.DB.prepare(
      "UPDATE notification_outbox SET status='sent',attempts=attempts+1,last_error=NULL,sent_at=datetime('now') WHERE id=?",
    )
      .bind(id)
      .run();
  } catch (e) {
    await env.DB.prepare(
      "UPDATE notification_outbox SET status='failed',attempts=attempts+1,last_error=? WHERE id=?",
    )
      .bind(String(e?.message || "send failed").slice(0, 500), id)
      .run();
  }
}
export async function sendResend(env, m) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: env.FROM_EMAIL,
      to: [m.to_email],
      reply_to: m.reply_to || undefined,
      subject: m.subject,
      html: m.html,
      text: m.text,
    }),
  });
  if (!r.ok) throw new Error(`email provider ${r.status}`);
}
