import test from "node:test";
import assert from "node:assert/strict";
import { buildLeadEnvelope, validateLeadEnvelope, classifyLeadDelivery } from "../src/lead-intake-contract-v1.mjs";

const valid = {
  leadId: "test-lead-001",
  submittedAt: "2026-11-07T12:00:00.000Z",
  project: { id: "kd-905-voronezh", name: "Клубный дом 905" },
  landing: { url: "https://key.example.test/kd905", version: "draft-test-1" },
  conversion: { scenarioId: "request-project-details", moduleId: "hero", entityContext: {} },
  contact: { name: "Тестовый пользователь", phone: "+70000000000" },
  consent: { granted: true, textVersion: "TEST-CONSENT-1", grantedAt: "2026-11-07T12:00:00.000Z" },
  attribution: { utmSource: "synthetic-test", yclid: "synthetic-click" }
};

test("builds a valid lead envelope with project, conversion, consent and attribution context", () => {
  const envelope = buildLeadEnvelope(valid);
  assert.equal(envelope.schemaVersion, "key-lead/1.0");
  assert.equal(envelope.project.id, "kd-905-voronezh");
  assert.equal(envelope.conversion.scenarioId, "request-project-details");
  assert.equal(envelope.consent.granted, true);
  assert.deepEqual(validateLeadEnvelope(envelope), []);
});

test("rejects missing consent and contact before any transport can run", () => {
  assert.throws(() => buildLeadEnvelope({
    ...valid, consent: { granted: false, textVersion: "TEST-CONSENT-1", grantedAt: valid.submittedAt }
  }), error => error.code === "INVALID_LEAD_ENVELOPE" && error.validationErrors.includes("Explicit consent is required."));
  assert.throws(() => buildLeadEnvelope({
    ...valid, contact: { name: "Тест" }
  }), /Contact phone is required/);
});

test("requires HTTPS landing URL", () => {
  assert.throws(() => buildLeadEnvelope({
    ...valid, landing: { url: "http://key.example.test", version: "1" }
  }), /Landing HTTPS URL and version are required/);
});

test("delivery succeeds only on explicit receiver acknowledgement with receipt ID", () => {
  assert.deepEqual(classifyLeadDelivery({ httpStatus: 200, response: { accepted: true, receiptId: "receipt-1" } }),
    { status: "accepted", accepted: true, receiptId: "receipt-1" });
  assert.deepEqual(classifyLeadDelivery({ httpStatus: 200, response: { accepted: true } }),
    { status: "not_confirmed", accepted: false, receiptId: null });
  assert.deepEqual(classifyLeadDelivery({ httpStatus: 504, response: { accepted: true, receiptId: "receipt-2" } }),
    { status: "not_confirmed", accepted: false, receiptId: null });
  assert.deepEqual(classifyLeadDelivery({ httpStatus: 202, response: { accepted: false } }),
    { status: "not_confirmed", accepted: false, receiptId: null });
});
