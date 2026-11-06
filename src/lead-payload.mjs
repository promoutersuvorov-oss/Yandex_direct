import { attributionToPayload } from "./attribution.mjs";

const ID = /^[a-z0-9][a-z0-9_-]{1,79}$/;
const CHANNELS = new Set(["phone", "telegram", "max", "whatsapp", "email"]);
const DEVICE_CLASSES = new Set(["mobile", "tablet", "desktop", "unknown"]);
const CONTEXT_KEYS = new Set(["rooms", "planId", "plan", "mortgage", "quizAnswers", "requestedInfo", "preferredViewing"]);
const ANSWER_ID = /^[a-z0-9][a-z0-9_-]{0,79}$/i;

function requiredString(value, field, max = 160) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
    throw new TypeError(field + " is required and must be at most " + max + " characters.");
  }
  return value.trim();
}

function optionalString(value, field, max = 256) {
  if (value == null || value === "") return undefined;
  return requiredString(value, field, max);
}

function safeUrl(value, field) {
  const raw = requiredString(value, field, 2048);
  const url = new URL(raw);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new TypeError(field + " must use HTTP or HTTPS.");
  }
  return url.toString();
}

function cleanAnswers(value) {
  if (value == null) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("qualification.answers must be an object.");
  }
  const entries = Object.entries(value);
  if (entries.length > 20) throw new TypeError("Too many qualification answers.");
  const result = {};
  for (const [key, answer] of entries) {
    if (!ANSWER_ID.test(key)) throw new TypeError("Invalid quiz answer key.");
    if (typeof answer === "string") result[key] = requiredString(answer, "quiz answer", 160);
    else if (Array.isArray(answer) && answer.length <= 10 && answer.every(x => typeof x === "string" && x.length <= 80)) {
      result[key] = [...new Set(answer)];
    } else {
      throw new TypeError("Quiz answers must be short strings or arrays of short strings.");
    }
  }
  return result;
}

function cleanContext(value) {
  if (value == null) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("conversion.entityContext must be an object.");
  }
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (!CONTEXT_KEYS.has(key)) throw new TypeError("Unsupported conversion context key: " + key);
    if (key === "rooms") {
      if (!Number.isInteger(item) || item < 0 || item > 10) throw new TypeError("rooms must be an integer from 0 to 10.");
      result.rooms = item;
    } else if (key === "quizAnswers") {
      result.quizAnswers = cleanAnswers(item) ?? {};
    } else if (key === "plan") {
      if (!item || typeof item !== "object" || Array.isArray(item)) throw new TypeError("plan context must be an object.");
      const rooms = item.rooms;
      const areaSqm = item.areaSqm;
      const floor = item.floor;
      if (!Number.isInteger(rooms) || rooms < 0 || rooms > 10) throw new TypeError("plan.rooms must be an integer from 0 to 10.");
      if (!Number.isFinite(areaSqm) || areaSqm <= 0) throw new TypeError("plan.areaSqm must be a positive number.");
      if (floor != null && (!Number.isInteger(floor) || floor < 1)) throw new TypeError("plan.floor must be a positive integer.");
      result.plan = {
        id: requiredString(item.id, "plan.id", 80),
        rooms,
        areaSqm,
        assetId: requiredString(item.assetId, "plan.assetId", 80),
        ...(floor == null ? {} : { floor }),
        ...(optionalString(item.finishing, "plan.finishing", 120) ? { finishing: item.finishing.trim() } : {})
      };
    } else if (key === "mortgage") {
      if (!item || typeof item !== "object" || Array.isArray(item)) throw new TypeError("mortgage context must be an object.");
      const { price, downPayment, ratePercent, termYears, estimatedMonthlyPayment } = item;
      if (![price, downPayment, ratePercent, termYears, estimatedMonthlyPayment].every(Number.isFinite)) {
        throw new TypeError("Mortgage context values must be finite numbers.");
      }
      if (price <= 0 || downPayment < 0 || downPayment >= price) throw new TypeError("Mortgage price and downPayment are invalid.");
      if (ratePercent < 0 || ratePercent > 100 || !Number.isInteger(termYears) || termYears < 1 || termYears > 40 || estimatedMonthlyPayment <= 0) {
        throw new TypeError("Mortgage rate, term or estimated payment is invalid.");
      }
      result.mortgage = { price, downPayment, ratePercent, termYears, estimatedMonthlyPayment };
    } else {
      result[key] = requiredString(item, "conversion.entityContext." + key, 160);
    }
  }
  return result;
}

export function createLeadPayload(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("Lead input must be an object.");
  const eventId = requiredString(input.eventId, "eventId", 80);
  const leadId = requiredString(input.leadId, "leadId", 80);
  const projectId = requiredString(input.projectId, "projectId", 80);
  if (!ID.test(eventId) || !ID.test(leadId) || !ID.test(projectId)) throw new TypeError("eventId, leadId and projectId must be stable lowercase IDs.");
  const contact = input.contact ?? {};
  const name = requiredString(contact.name, "contact.name", 100);
  const phone = requiredString(contact.phone, "contact.phone", 32);
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) throw new TypeError("contact.phone must contain 7 to 15 digits.");
  const preferredChannel = contact.preferredChannel ?? "phone";
  if (!CHANNELS.has(preferredChannel)) throw new TypeError("Unsupported preferred contact channel.");
  const consent = input.consent ?? {};
  if (consent.accepted !== true) throw new TypeError("Explicit consent is required.");
  const consentAcceptedAt = requiredString(consent.acceptedAt, "consent.acceptedAt", 40);
  if (!Number.isFinite(Date.parse(consentAcceptedAt))) throw new TypeError("consent.acceptedAt must be a valid date-time.");
  const consentPolicyVersion = requiredString(consent.policyVersion, "consent.policyVersion", 40);
  const consentPolicyUrl = safeUrl(consent.policyUrl, "consent.policyUrl");
  const conversion = input.conversion ?? {};
  const scenarioId = requiredString(conversion.scenarioId, "conversion.scenarioId", 80);
  if (!ID.test(scenarioId)) throw new TypeError("conversion.scenarioId must be a stable ID.");
  const createdAt = requiredString(input.createdAt, "createdAt", 40);
  if (!Number.isFinite(Date.parse(createdAt))) throw new TypeError("createdAt must be a valid date-time.");
  const deviceClass = input.deviceClass ?? "unknown";
  if (!DEVICE_CLASSES.has(deviceClass)) throw new TypeError("Unsupported deviceClass.");
  const payload = {
    schemaVersion: "1.0.0",
    eventId,
    leadId,
    projectId,
    createdAt: new Date(createdAt).toISOString(),
    pageUrl: safeUrl(input.pageUrl, "pageUrl"),
    deviceClass,
    contact: {
      name,
      phone,
      preferredChannel,
      ...(optionalString(contact.preferredTime, "contact.preferredTime", 80)
        ? { preferredTime: contact.preferredTime.trim() } : {})
    },
    consent: {
      policyVersion: consentPolicyVersion,
      acceptedAt: new Date(consentAcceptedAt).toISOString(),
      policyUrl: consentPolicyUrl
    },
    conversion: {
      scenarioId,
      ...(optionalString(conversion.offerId, "conversion.offerId", 80) ? { offerId: conversion.offerId.trim() } : {}),
      ...(optionalString(conversion.moduleId, "conversion.moduleId", 80) ? { moduleId: conversion.moduleId.trim() } : {}),
      ...(cleanContext(conversion.entityContext) ? { entityContext: cleanContext(conversion.entityContext) } : {})
    },
    ...(input.referrer ? { referrer: safeUrl(input.referrer, "referrer") } : {}),
    ...(input.qualification?.answers ? { qualification: { answers: cleanAnswers(input.qualification.answers) } } : {}),
    ...(input.attribution ? { attribution: attributionToPayload(input.attribution) } : {}),
    ...(input.analytics?.sessionId ? { analytics: { sessionId: requiredString(input.analytics.sessionId, "analytics.sessionId", 128) } } : {})
  };
  return payload;
}
