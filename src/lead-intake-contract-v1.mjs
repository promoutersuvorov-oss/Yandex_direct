const nonEmpty = value => typeof value === "string" && value.trim().length > 0;
const safeHttpsUrl = value => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
};

/**
 * Builds a lead envelope without sending or persisting it.
 * Call only after explicit consent has been collected in the real UI.
 */
export function buildLeadEnvelope(input = {}) {
  const {
    leadId, submittedAt, project, landing, conversion, contact, consent,
    attribution = {}
  } = input;
  const envelope = {
    schemaVersion: "key-lead/1.0",
    leadId,
    submittedAt,
    project: { id: project?.id, name: project?.name },
    landing: { url: landing?.url, version: landing?.version },
    conversion: {
      scenarioId: conversion?.scenarioId,
      moduleId: conversion?.moduleId ?? null,
      entityContext: conversion?.entityContext ?? {}
    },
    contact: {
      name: contact?.name,
      phone: contact?.phone,
      preferredChannel: contact?.preferredChannel ?? "phone",
      preferredTime: contact?.preferredTime ?? null
    },
    consent: {
      granted: consent?.granted === true,
      textVersion: consent?.textVersion,
      grantedAt: consent?.grantedAt
    },
    attribution: {
      utmSource: attribution.utmSource ?? null,
      utmMedium: attribution.utmMedium ?? null,
      utmCampaign: attribution.utmCampaign ?? null,
      utmContent: attribution.utmContent ?? null,
      utmTerm: attribution.utmTerm ?? null,
      yclid: attribution.yclid ?? null
    }
  };
  const errors = validateLeadEnvelope(envelope);
  if (errors.length) {
    const error = new Error("Lead envelope is invalid: " + errors.join("; "));
    error.code = "INVALID_LEAD_ENVELOPE";
    error.validationErrors = errors;
    throw error;
  }
  return envelope;
}

export function validateLeadEnvelope(value) {
  const errors = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) return ["Envelope must be an object."];
  if (value.schemaVersion !== "key-lead/1.0") errors.push("Unsupported schemaVersion.");
  if (!nonEmpty(value.leadId)) errors.push("leadId is required.");
  if (!nonEmpty(value.submittedAt) || !Number.isFinite(Date.parse(value.submittedAt))) errors.push("submittedAt must be a valid timestamp.");
  if (!nonEmpty(value.project?.id) || !nonEmpty(value.project?.name)) errors.push("Project identity is required.");
  if (!safeHttpsUrl(value.landing?.url) || !nonEmpty(value.landing?.version)) errors.push("Landing HTTPS URL and version are required.");
  if (!nonEmpty(value.conversion?.scenarioId)) errors.push("Conversion scenarioId is required.");
  if (!nonEmpty(value.contact?.name)) errors.push("Contact name is required.");
  if (!nonEmpty(value.contact?.phone)) errors.push("Contact phone is required.");
  if (!["phone", "messenger", "email"].includes(value.contact?.preferredChannel)) errors.push("preferredChannel is invalid.");
  if (value.consent?.granted !== true) errors.push("Explicit consent is required.");
  if (!nonEmpty(value.consent?.textVersion)) errors.push("Consent textVersion is required.");
  if (!nonEmpty(value.consent?.grantedAt) || !Number.isFinite(Date.parse(value.consent.grantedAt))) errors.push("Consent timestamp is required.");
  return errors;
}

/**
 * A transport is successful only when HTTP is 2xx AND the receiver explicitly
 * acknowledges acceptance with a stable receipt ID. A timeout or ambiguous
 * response must never be shown as a successful lead.
 */
export function classifyLeadDelivery({ httpStatus, response } = {}) {
  const accepted = Number.isInteger(httpStatus) && httpStatus >= 200 && httpStatus < 300 &&
    response?.accepted === true && nonEmpty(response?.receiptId);
  return accepted
    ? { status: "accepted", accepted: true, receiptId: response.receiptId }
    : { status: "not_confirmed", accepted: false, receiptId: null };
}
