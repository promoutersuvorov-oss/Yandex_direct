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

test("preserves typed apartment-plan context and validates its evidence identifiers", () => {
  const input = valid();
  input.conversion.entityContext = {
    plan: { id: "plan-a", rooms: 2, areaSqm: 64.5, floor: 8, finishing: "white-box", assetId: "asset-plan-a" }
  };
  assert.deepEqual(createLeadPayload(input).conversion.entityContext, input.conversion.entityContext);
  input.conversion.entityContext.plan.areaSqm = 0;
  assert.throws(() => createLeadPayload(input), /plan.areaSqm must be a positive number/);
});

test("preserves a validated mortgage estimate in the lead context", () => {
  const input = valid();
  input.conversion.entityContext = {
    mortgage: { price: 8000000, downPayment: 2000000, ratePercent: 12, termYears: 20, estimatedMonthlyPayment: 66072 }
  };
  assert.deepEqual(createLeadPayload(input).conversion.entityContext, input.conversion.entityContext);
  input.conversion.entityContext.mortgage.downPayment = 8000000;
  assert.throws(() => createLeadPayload(input), /Mortgage price and downPayment are invalid/);
});


test("preserves validated marketing strategy IDs in the conversion payload", () => {
  const input = valid();
  input.conversion = {
    scenarioId: "presentation_request",
    offerId: "presentation",
    moduleId: "hero",
    ctaId: "hero_presentation",
    hookId: "walkable_daily_needs",
    funnelId: "location_to_presentation",
    segmentId: "young_professionals"
  };
  const conversion = createLeadPayload(input).conversion;
  assert.deepEqual(
    { ctaId: conversion.ctaId, hookId: conversion.hookId, funnelId: conversion.funnelId, segmentId: conversion.segmentId },
    {
      ctaId: "hero_presentation",
      hookId: "walkable_daily_needs",
      funnelId: "location_to_presentation",
      segmentId: "young_professionals"
    }
  );
  input.conversion.ctaId = "Invalid ID!";
  assert.throws(() => createLeadPayload(input), /stable ID/);
});

test("preserves required contact channel and preferred callback time",()=>{
  const input=valid();
  input.contact.preferredChannel="telegram";
  input.contact.preferredTime="После 18:00";
  const payload=createLeadPayload(input);
  assert.equal(payload.contact.preferredChannel,"telegram");
  assert.equal(payload.contact.preferredTime,"После 18:00");
});


test("preserves validated marketing intent in the conversion payload", () => {
  const input = valid();
  input.conversion = {
    scenarioId: "galiley.presentation",
    offerId: "presentation",
    moduleId: "hero",
    ctaId: "test_hero_presentation",
    intent: "get_information"
  };
  const conversion = createLeadPayload(input).conversion;
  assert.equal(conversion.intent, "get_information");
  assert.equal(conversion.scenarioId, "galiley.presentation");
  input.conversion.intent = "send_all_data";
  assert.throws(() => createLeadPayload(input), /Unsupported conversion intent/);
});


test("preserves validated qualification question references in conversion context", () => {
  const input = valid();
  input.conversion = {
    scenarioId: "galiley.presentation",
    intent: "get_information",
    qualificationQuestionIds: ["budget_range", "move_timing", "budget_range"]
  };
  assert.deepEqual(createLeadPayload(input).conversion.qualificationQuestionIds, ["budget_range", "move_timing"]);
  input.conversion.qualificationQuestionIds = ["not a stable id"];
  assert.throws(() => createLeadPayload(input), /must contain stable IDs/);
  input.conversion.qualificationQuestionIds = Array.from({ length: 21 }, (_, index) => "question_" + index);
  assert.throws(() => createLeadPayload(input), /at most 20 IDs/);
});
