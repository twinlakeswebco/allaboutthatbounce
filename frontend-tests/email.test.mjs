import assert from "node:assert/strict";
import { test } from "node:test";
import { requestMails, decisionMail, sendResend } from "../worker/email.js";

const request = {
  unit_name: "Example <script>alert(1)</script>",
  event_date: "2099-06-15",
  name: "Example Customer",
  phone: "5550100100",
  email: "customer@example.test",
  delivery_address: "100 Example St, Anytown, KY",
  distance_miles: 16,
  delivery_fee_cents: 2240,
  total_cents: 18240,
};
const received = () =>
  requestMails(request, {
    OWNER_EMAIL: "owner@example.test",
    SITE_ORIGIN: "https://example.test",
  })[1];

for (const [kind, build] of [
  ["request received", received],
  ["confirmed", () => decisionMail(request, "confirmed")],
]) {
  test(`${kind} email includes logistics in text and escaped HTML`, () => {
    const mail = build();
    for (const content of [mail.text, mail.html]) {
      for (const expected of [
        "Eight hours",
        "pickup",
        "text your delivery ETA the evening before",
        "10 p.m.",
        "$10 service fee",
        "including gusts",
        "sign the waiver",
        "before setup",
        "Cash or check",
        "48 hours",
        "10–50 minutes",
        "502-851-7596",
        "allaboutthatbounce7596@gmail.com",
      ])
        assert.ok(content.includes(expected), expected);
    }
    assert.doesNotMatch(mail.text + mail.html, /deposit/i);
    assert.doesNotMatch(mail.html, /<script>/);
    assert.match(mail.html, /&lt;script&gt;/);
  });
}
test("request stays unconfirmed and decision subjects remain unchanged", () => {
  assert.match(received().text, /isn’t booked until the owner confirms/);
  assert.equal(decisionMail(request, "confirmed").subject, "Booking confirmed");
  assert.equal(decisionMail(request, "declined").subject, "Booking request update");
});

const emailEnv = {
  FROM_EMAIL: "Test Sender <bookings@example.test>",
  OWNER_EMAIL: "owner@example.test",
  RESEND_API_KEY: "fake-resend-key",
};
test("customer notification replies reach the owner inbox instead of the sending address", async (t) => {
  const sent = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "https://api.resend.com/emails");
    sent.push(JSON.parse(options.body));
    return new Response(JSON.stringify({ id: "fake-email-id" }), { status: 200 });
  });
  for (const mail of [
    received(),
    decisionMail(request, "confirmed"),
    decisionMail(request, "declined"),
  ]) {
    await sendResend(emailEnv, mail);
  }
  assert.equal(sent.length, 3);
  for (const payload of sent) {
    assert.equal(payload.from, emailEnv.FROM_EMAIL);
    assert.deepEqual(payload.to, [request.email]);
    assert.equal(payload.reply_to, emailEnv.OWNER_EMAIL);
  }
});
test("owner notification replies still reach the requesting customer", async (t) => {
  let payload;
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    payload = JSON.parse(options.body);
    return new Response(JSON.stringify({ id: "fake-email-id" }), { status: 200 });
  });
  const mail = requestMails(request, { ...emailEnv, SITE_ORIGIN: "https://example.test" })[0];
  await sendResend(emailEnv, mail);
  assert.deepEqual(payload.to, [emailEnv.OWNER_EMAIL]);
  assert.equal(payload.reply_to, request.email);
});
