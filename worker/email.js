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
    "We’ll reply soon to confirm. Payment is cash or check at delivery.",
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
          "Delivery is generally between 7 and 11 a.m., and pickup starts at 6 p.m. It’s an all-day, 8-hour rental. We’ll call the day before to confirm times.",
          "Setup takes 30–45 minutes and ends with a quick safety review with the responsible adult.",
          "Payment is due in full at delivery, before setup. Cash or check; exact cash, please.",
          "Please have a clear, debris-free setup area and a dedicated outlet within 75 feet.",
          "If the weather turns, you can cancel free up to 2 hours before drop-off.",
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
