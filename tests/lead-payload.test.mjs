import assert from "node:assert/strict";
import test from "node:test";
import { createLeadPayload } from "../src/lead-payload.mjs";

const valid = () => ({
  eventId: "evt_001",
  leadId: "lead_001",
  projectId: "k15",
  createdAt: "2026-11-05T14:00:00Z",
  pageUrl: "https://key.example/k15",
  deviceClass: "mobile",
  contact: { name: "Анна", phone: "+7 999 123-45-67", preferredChannel: "telegram" },
  consent: { accepted: true, acceptedAt: "2026-11-05T14:00:00Z", policyVersion: "2026-01", policyUrl: "https://key.example/privacy" },
  conversion: { scenarioId: "apartment-selection", entityContext: { rooms: 2, planId: "plan-2" } },
  attribution: { firstTouch: { utm_source: "yandex" }, lastTouch: { utm_source: "vk" } }
});

test("builds a versioned lead payload with separate first and last touch", () => {
  const payload = createLeadPayload(valid());
  assert.equal(payload.schemaVersion, "1.0.0");
  assert.equal(payload.contact.phone, "+7 999 123-45-67");
  assert.deepEqual(payload.attribution, {
    first_touch: { utm_source: "yandex" },
    last_touch: { utm_source: "vk" }
  });
  assert.deepEqual(payload.conversion.entityContext, { rooms: 2, planId: "plan-2" });
});

test("requires explicit consent and valid phone", () => {
  const noConsent = valid();
  noConsent.consent.accepted = false;
  assert.throws(() => createLeadPayload(noConsent), /Explicit consent/);
  const badPhone = valid();
  badPhone.contact.phone = "123";
  assert.throws(() => createLeadPayload(badPhone), /7 to 15 digits/);
});

test("rejects unknown context keys and unsafe URLs", () => {
  const badContext = valid();
  badContext.conversion.entityContext.internalPrice = "secret";
  assert.throws(() => createLeadPayload(badContext), /Unsupported conversion context key/);
  const badUrl = valid();
  badUrl.pageUrl = "javascript:alert(1)";
  assert.throws(() => createLeadPayload(badUrl), /HTTP or HTTPS/);
});

test("does not forward arbitrary fields from browser input", () => {
  const input = valid();
  input.admin = true;
  input.internalCommercialData = { margin: 999 };
  const payload = createLeadPayload(input);
  assert.equal("admin" in payload, false);
  assert.equal("internalCommercialData" in payload, false);
});

test("limits quiz answers and validates answer shape", () => {
  const input = valid();
  input.qualification = { answers: { rooms: "2", budget: ["до 10 млн"] } };
  assert.deepEqual(createLeadPayload(input).qualification.answers, { rooms: "2", budget: ["до 10 млн"] });
  input.qualification.answers.rooms = { arbitrary: "object" };
  assert.throws(() => createLeadPayload(input), /Quiz answers/);
});
