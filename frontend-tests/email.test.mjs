import assert from "node:assert/strict";
import { test } from "node:test";
import { requestMails, decisionMail } from "../worker/email.js";

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
        "7 and 11 a.m.",
        "6 p.m.",
        "day before",
        "before setup",
        "Cash or check",
        "2 hours",
        "No advance deposit",
        "502-851-7596",
        "allaboutthatbounce7596@gmail.com",
      ])
        assert.ok(content.includes(expected), expected);
    }
    assert.doesNotMatch(mail.html, /<script>/);
    assert.match(mail.html, /&lt;script&gt;/);
  });
}
test("request stays unconfirmed and decision subjects remain unchanged", () => {
  assert.match(received().text, /isn’t booked until the owner confirms/);
  assert.equal(decisionMail(request, "confirmed").subject, "Booking confirmed");
  assert.equal(decisionMail(request, "declined").subject, "Booking request update");
});
