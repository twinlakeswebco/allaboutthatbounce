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
const CONTACT = "Call 502-851-7596 or email allaboutthatbounce7596@gmail.com.";
const LOGISTICS = [
  "Eight hours are guaranteed. Delivery and pickup times are confirmed personally. Extra hours or overnight use may be available by arrangement, depending on the next booking. We will text your delivery ETA the evening before, sometimes as late as 10 p.m. Your event start and end times are party times, not delivery times. You are welcome to call us with questions.",
  "Setup takes 10–50 minutes, depending on your rental, and ends with a quick safety review with the responsible adult.",
  "The full balance is due at delivery, before setup. Cash or check only; checks carry a $10 service fee. Please have payment ready when we arrive. Someone must be present to sign the waiver. We cannot set up without payment or accept payment at pickup.",
  "Please have a clear, debris-free setup area and a dedicated outlet within 75 feet.",
  "We do not set up outdoors below 50°F, during thunderstorms, or with winds over 15 mph, including gusts. Rain alone does not necessarily mean cancellation; we will discuss conditions with you. If your plans change, please give us at least 48 hours’ notice when possible. Contact us to discuss cancellations.",
];
// Paragraphs become text (blank-line separated) and escaped HTML (first one bold).
const body = (ps) => ({
  text: ps.join("\n\n"),
  html: ps
    .map((p, i) => {
      const t = escapeHtml(p).replace(/\n/g, "<br>");
      return `<p>${i ? t : `<strong>${t}</strong>`}</p>`;
    })
    .join(""),
});
export function requestMails(r, env) {
  const admin = `New booking request\nUnit: ${r.unit_name}\nDate: ${r.event_date}\nCustomer: ${r.name}\nPhone: ${r.phone}\nEmail: ${r.email}\nDelivery address: ${r.delivery_address}\nDistance: ${r.distance_miles} miles\nDelivery fee: ${money(r.delivery_fee_cents)}\nTotal: ${money(r.total_cents)}\n${env.SITE_ORIGIN}/admin.html`;
  const safe = escapeHtml(admin).replace(/\n/g, "<br>");
  const customer = body([
    "We got your request. Your date isn’t booked until the owner confirms it.",
    `Unit: ${r.unit_name}\nDate: ${r.event_date}\nEstimated total: ${money(r.total_cents)}`,
    "We’ll reply soon. If your request is confirmed, here’s what to expect:",
    ...LOGISTICS,
    `Questions? ${CONTACT}`,
  ]);
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
      customer.text,
      customer.html,
    ),
  ];
}
export function decisionMail(r, status) {
  const confirmed = status === "confirmed";
  const m = body(
    confirmed
      ? [
          "Your booking is confirmed.",
          `Unit: ${r.unit_name}\nDate: ${r.event_date}\nTotal: ${money(r.total_cents)}`,
          ...LOGISTICS,
          `Questions? ${CONTACT}`,
        ]
      : [
          "We’re sorry, but we can’t confirm this booking request.",
          `We’d love to help you find another date or unit. ${CONTACT}`,
        ],
  );
  return mailRow(
    status,
    r.email,
    null,
    confirmed ? "Booking confirmed" : "Booking request update",
    m.text,
    m.html,
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
export function outboxStatement(env, m, decision = null) {
  if (decision) {
    return env.DB.prepare(
      "INSERT INTO notification_outbox(id,kind,to_email,reply_to,subject,html,text) SELECT ?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM booking_requests WHERE id = ? AND decision_token = ?)",
    ).bind(
      m.id,
      m.kind,
      m.to_email,
      m.reply_to,
      m.subject,
      m.html,
      m.text,
      decision.id,
      decision.token,
    );
  }
  return env.DB.prepare(
    "INSERT INTO notification_outbox(id,kind,to_email,reply_to,subject,html,text) VALUES(?,?,?,?,?,?,?)",
  ).bind(m.id, m.kind, m.to_email, m.reply_to, m.subject, m.html, m.text);
}
export async function sendOutbox(env, id, sender = sendResend) {
  // Until email delivery is configured, leave rows pending so no retry attempts are spent.
  if (sender === sendResend && !env.RESEND_API_KEY) return;
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
      reply_to: m.reply_to || env.OWNER_EMAIL,
      subject: m.subject,
      html: m.html,
      text: m.text,
    }),
  });
  if (!r.ok) throw new Error(`email provider ${r.status}`);
}
