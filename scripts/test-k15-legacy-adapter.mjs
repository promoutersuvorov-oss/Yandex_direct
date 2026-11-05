import assert from "node:assert/strict";
import {
  buildCanonicalLeadPayload,
  mapK15LegacyConfig,
  normalizeAttribution
} from "../scripts/k15-legacy-adapter.mjs";

const first = normalizeAttribution(
  { utm_source: "yandex", yclid: "click-1" },
  {}
);
assert.deepEqual(first.firstTouch, { utm_source: "yandex", yclid: "click-1" });
assert.deepEqual(first.lastTouch, { utm_source: "yandex", yclid: "click-1" });

const second = normalizeAttribution(
  { utm_source: "vk", utm_campaign: "retarget", gclid: "click-2" },
  first
);
assert.deepEqual(second.firstTouch, { utm_source: "yandex", yclid: "click-1" });
assert.deepEqual(second.lastTouch, { utm_source: "vk", utm_campaign: "retarget", gclid: "click-2" });

const noNewCampaign = normalizeAttribution({}, second);
assert.deepEqual(noNewCampaign.firstTouch, second.firstTouch);
assert.deepEqual(noNewCampaign.lastTouch, second.lastTouch);

const mapped = mapK15LegacyConfig({
  phone: "+70000000000",
  address: "Тестовый адрес",
  mapLat: "51.67",
  mapLon: "39.18",
  endpoint: "https://example.invalid/private-endpoint",
  metrikaId: "12345",
  vkPixelId: "pixel-secret",
  privacyUrl: "https://example.invalid/privacy",
  bots: { telegram: "https://t.me/example", max: "#", vk: "" },
  social: { good: "https://example.com/social", placeholder: "#" },
  vars: { PRICE_FROM: "10000000", DELIVERY_DATE: "2027" },
  callbackSla: "5 минут"
});
assert.deepEqual(mapped.project.coordinates, { lat: 51.67, lng: 39.18 });
assert.equal(mapped.contacts.phone, "+70000000000");
assert.deepEqual(mapped.integrations.messengerConfigured, {
  telegram: true, max: false, vk: false
});
assert.equal(mapped.integrations.leadEndpointConfigured, true);
assert.equal(mapped.security.endpointWithheld, true);
assert.equal(mapped.security.metrikaIdWithheld, true);
assert.equal(mapped.security.privacyUrlWithheld, true);
assert.ok(!JSON.stringify(mapped).includes("private-endpoint"));
assert.ok(!JSON.stringify(mapped).includes("pixel-secret"));
assert.ok(!JSON.stringify(mapped).includes("12345"));
assert.ok(!JSON.stringify(mapped).includes("example.invalid/privacy"));
assert.deepEqual(mapped.contacts.social, { good: "https://example.com/social" });
assert.equal(mapped.commercial.priceFrom, "10000000");
assert.equal(mapped.commercial.deliveryDate, "2027");

const invalidCoordinates = mapK15LegacyConfig({ mapLat: 999, mapLon: 20 });
assert.equal(invalidCoordinates.project.coordinates, null);

const payload = buildCanonicalLeadPayload({
  eventId: "event-1", leadId: "lead-1", projectId: "project-a",
  createdAt: "2026-11-05T12:00:00Z",
  pageUrl: "https://example.com/project", referrer: "https://yandex.ru",
  name: "Анна", phone: "+79990000000", preferredChannel: "telegram",
  preferredTime: "evening",
  consent: {
    accepted: true, policyVersion: "2026-01", acceptedAt: "2026-11-05T12:00:00Z",
    policyUrl: "https://example.com/privacy"
  },
  scenarioId: "plans", offerId: "selection", moduleId: "floor-plans",
  entityContext: { rooms: 2, planId: "plan-2" },
  answers: { purpose: "living" },
  attribution: { current: { utm_source: "yandex" } }
});
assert.equal(payload.contact.preferredChannel, "telegram");
assert.equal(payload.conversion.entityContext.planId, "plan-2");
assert.equal(payload.attribution.firstTouch.utm_source, "yandex");
assert.throws(() => buildCanonicalLeadPayload({ name: "Анна", phone: "123", preferredChannel: "call" }), /consent/);
assert.throws(() => buildCanonicalLeadPayload({ phone: "123", consent: { accepted: true }, preferredChannel: "call" }), /name/);
assert.throws(() => buildCanonicalLeadPayload({ name: "Анна", phone: "123", consent: { accepted: true }, preferredChannel: "fax" }), /Unsupported/);

console.log("PASS: K15 adapter isolation, first/last-touch attribution and canonical lead payload.");
