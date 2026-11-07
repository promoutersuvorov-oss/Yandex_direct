import test from "node:test";
import assert from "node:assert/strict";
import { buildValueConversion, validateValueConversion } from "../src/value-conversion-contract-v1.mjs";

const base = () => ({
  scenarioId: "mortgage-calculation-followup",
  offerId: "mortgage-help",
  moduleId: "mortgage-calculator",
  valueProposition: {
    title: "Получить индивидуальный кредитный расчёт",
    description: "Специалист проверит доступные программы и подготовит расчёт по выбранной квартире."
  },
  interaction: { type: "calculator", actionLabel: "Получить индивидуальный расчёт" },
  fulfillment: { mode: "credit_calculation", serviceId: "key-mortgage-review" },
  contactRequest: { required: true, purposeId: "individual_credit_calculation", purpose: "Получить индивидуальный кредитный расчёт по выбранным параметрам", fields: ["name", "phone"] },
  entityContext: { budget: 8500000, downPayment: 2000000, loanTermMonths: 300, planId: "plan-2" }
});

test("builds a contextual conversion preserving calculator inputs and specific value", () => {
  const conversion = buildValueConversion(base());
  assert.equal(conversion.schemaVersion, "key-value-conversion/1.0");
  assert.equal(conversion.fulfillment.serviceId, "key-mortgage-review");
  assert.equal(conversion.contactRequest.purpose, "Получить индивидуальный кредитный расчёт по выбранным параметрам");
  assert.equal(conversion.entityContext.budget, 8500000);
  assert.deepEqual(validateValueConversion(conversion), []);
});

test("supports immediate on-page value without asking for contact details", () => {
  const conversion = buildValueConversion({
    ...base(),
    scenarioId: "instant-mortgage-estimate",
    offerId: null,
    fulfillment: { mode: "on_page" },
    contactRequest: { required: false, purposeId: null, purpose: null, fields: [] }
  });
  assert.equal(conversion.contactRequest.required, false);
});

test("rejects generic contact capture without a specific fulfillment purpose", () => {
  assert.throws(() => buildValueConversion({
    ...base(),
    contactRequest: { required: true, purpose: "Оставьте контакты, мы свяжемся с вами", fields: ["phone"] }
  }), error => error.code === "INVALID_VALUE_CONVERSION" && /specific value/.test(error.message));
});

test("rejects fake asset or service promises without configured identifiers", () => {
  assert.throws(() => buildValueConversion({
    ...base(), fulfillment: { mode: "asset_delivery" }
  }), /real assetId/);
  assert.throws(() => buildValueConversion({
    ...base(), fulfillment: { mode: "expert_followup" }
  }), /configured serviceId/);
});

test("requires minimum field declaration and disallows contact fields for instant interactions", () => {
  assert.throws(() => buildValueConversion({
    ...base(), contactRequest: { required: true, purposeId: "individual_credit_calculation", purpose: "Получить расчёт", fields: [] }
  }), /minimum required fields/);
  assert.throws(() => buildValueConversion({
    ...base(), fulfillment: { mode: "on_page" },
    contactRequest: { required: false, purposeId: null, purpose: null, fields: ["phone"] }
  }), /must not request/);
});

test("rejects arbitrary entity context and malformed IDs", () => {
  assert.throws(() => buildValueConversion({
    ...base(), entityContext: { internalMargin: 100 }
  }), /Unsupported entityContext key/);
  assert.throws(() => buildValueConversion({
    ...base(), scenarioId: "Mortgage Scenario"
  }), /stable ID/);
});
