import assert from "node:assert/strict";
import test from "node:test";
import {
  readAttribution,
  mergeAttribution,
  createAttributionState,
  attributionToPayload
} from "../src/attribution.mjs";

test("reads only known campaign and click identifiers", () => {
  assert.deepEqual(readAttribution("?utm_source=yandex&utm_campaign=spring&yclid=abc&phone=7999"), {
    utm_source: "yandex",
    utm_campaign: "spring",
    yclid: "abc"
  });
});

test("ignores empty, whitespace and control-character values", () => {
  assert.equal(readAttribution("?utm_source=%20&utm_medium=%00"), null);
});

test("preserves first touch and updates last touch on a later campaign", () => {
  const first = createAttributionState("?utm_source=yandex&utm_campaign=one");
  const second = createAttributionState("?utm_source=vk&utm_campaign=two", first);
  assert.deepEqual(second.firstTouch, { utm_source: "yandex", utm_campaign: "one" });
  assert.deepEqual(second.lastTouch, { utm_source: "vk", utm_campaign: "two" });
});

test("direct revisit does not erase a previous last touch", () => {
  const state = createAttributionState("", {
    firstTouch: { utm_source: "google" },
    lastTouch: { utm_source: "vk" }
  });
  assert.deepEqual(state, {
    firstTouch: { utm_source: "google" },
    lastTouch: { utm_source: "vk" }
  });
});

test("payload exposes both attribution models separately", () => {
  assert.deepEqual(attributionToPayload({
    firstTouch: { utm_source: "first" },
    lastTouch: { utm_source: "last" }
  }), {
    first_touch: { utm_source: "first" },
    last_touch: { utm_source: "last" }
  });
});

test("bounds parameter length and excludes unknown keys", () => {
  const result = readAttribution("?utm_source=" + "x".repeat(300) + "&email=test@example.com");
  assert.equal(result.utm_source.length, 256);
  assert.equal("email" in result, false);
});
