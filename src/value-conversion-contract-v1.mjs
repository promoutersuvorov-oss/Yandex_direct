const ID = /^[a-z][a-z0-9._-]{1,79}$/;
const MODES = new Set(["on_page", "asset_delivery", "credit_calculation", "expert_followup", "callback"]);
const FIELDS = new Set(["name", "phone", "email", "preferredTime", "preferredChannel"]);
const CONTEXT_KEYS = new Set(["planId", "rooms", "areaSqm", "budget", "downPayment", "loanTermMonths", "question", "quizAnswers"]);

const nonEmpty = value => typeof value === "string" && value.trim().length > 0;

function fail(message) {
  const error = new TypeError(message);
  error.code = "INVALID_VALUE_CONVERSION";
  throw error;
}

/**
 * Creates a deterministic, privacy-safe conversion definition.
 * It describes the value offered and the next action; it never collects
 * contact data, sends a lead, or claims fulfillment has happened.
 */
export function buildValueConversion(input = {}) {
  const value = {
    schemaVersion: "key-value-conversion/1.0",
    scenarioId: input.scenarioId,
    offerId: input.offerId ?? null,
    moduleId: input.moduleId,
    valueProposition: {
      title: input.valueProposition?.title,
      description: input.valueProposition?.description
    },
    interaction: {
      type: input.interaction?.type,
      actionLabel: input.interaction?.actionLabel
    },
    fulfillment: {
      mode: input.fulfillment?.mode,
      assetId: input.fulfillment?.assetId ?? null,
      serviceId: input.fulfillment?.serviceId ?? null
    },
    contactRequest: {
      required: input.contactRequest?.required,
      purposeId: input.contactRequest?.purposeId ?? null,
      purpose: input.contactRequest?.purpose ?? null,
      fields: input.contactRequest?.fields ?? []
    },
    entityContext: input.entityContext ?? {}
  };
  validateValueConversion(value);
  return value;
}

export function validateValueConversion(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("Conversion must be an object.");
  if (value.schemaVersion !== "key-value-conversion/1.0") fail("Unsupported conversion schemaVersion.");
  if (!nonEmpty(value.scenarioId) || !ID.test(value.scenarioId)) fail("scenarioId must be a stable ID.");
  if (value.offerId !== null && (!nonEmpty(value.offerId) || !ID.test(value.offerId))) fail("offerId must be null or a stable ID.");
  if (!nonEmpty(value.moduleId) || !ID.test(value.moduleId)) fail("moduleId must be a stable ID.");
  if (!nonEmpty(value.valueProposition?.title) || !nonEmpty(value.valueProposition?.description)) fail("A concrete value proposition title and description are required.");
  if (!nonEmpty(value.interaction?.type) || !nonEmpty(value.interaction?.actionLabel)) fail("Interaction type and specific action label are required.");
  if (!MODES.has(value.fulfillment?.mode)) fail("Unsupported fulfillment mode.");
  if (value.fulfillment.mode === "asset_delivery" && !nonEmpty(value.fulfillment.assetId)) fail("Asset delivery requires a real assetId.");
  if (["credit_calculation", "expert_followup", "callback"].includes(value.fulfillment.mode) && !nonEmpty(value.fulfillment.serviceId)) fail("Service fulfillment requires a configured serviceId.");
  if (typeof value.contactRequest?.required !== "boolean") fail("contactRequest.required must be explicit.");
  if (!Array.isArray(value.contactRequest.fields) || value.contactRequest.fields.some(field => !FIELDS.has(field)) || new Set(value.contactRequest.fields).size !== value.contactRequest.fields.length) fail("Contact fields must be a unique allowlisted array.");
  if (value.contactRequest.required) {
    if (!nonEmpty(value.contactRequest.purposeId) || !ID.test(value.contactRequest.purposeId)) fail("Contact request must use a stable, scenario-specific purposeId.");
    if (!nonEmpty(value.contactRequest.purpose)) fail("Contact request must explain the specific value the visitor will receive.");
    const allowedPurposeIds = {
      credit_calculation: ["individual_credit_calculation"],
      expert_followup: ["expert_answer"],
      callback: ["scheduled_callback"],
      asset_delivery: ["send_requested_asset"]
    }[value.fulfillment.mode];
    if (allowedPurposeIds && !allowedPurposeIds.includes(value.contactRequest.purposeId)) fail("Contact purpose does not match the promised fulfillment.");
    if (value.contactRequest.fields.length === 0) fail("A contact request must declare the minimum required fields.");
  } else if (value.contactRequest.purposeId !== null || value.contactRequest.purpose !== null || value.contactRequest.fields.length !== 0) {
    fail("A no-contact interaction must not request a contact purpose or fields.");
  }
  if (!value.entityContext || typeof value.entityContext !== "object" || Array.isArray(value.entityContext)) fail("entityContext must be an object.");
  for (const [key, item] of Object.entries(value.entityContext)) {
    if (!CONTEXT_KEYS.has(key)) fail("Unsupported entityContext key: " + key);
    if (key === "rooms" || key === "loanTermMonths") {
      if (!Number.isInteger(item) || item < 0) fail(key + " must be a non-negative integer.");
    } else if (key === "areaSqm" || key === "budget" || key === "downPayment") {
      if (typeof item !== "number" || !Number.isFinite(item) || item < 0) fail(key + " must be a non-negative number.");
    } else if (key === "quizAnswers") {
      if (!item || typeof item !== "object" || Array.isArray(item)) fail("quizAnswers must be an object.");
    } else if (typeof item !== "string" || item.length > 500) fail(key + " must be a short string.");
  }
  return [];
}
