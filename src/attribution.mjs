const ATTRIBUTION_KEYS = Object.freeze([
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "yclid", "ysclid", "gclid", "gbraid", "wbraid", "fbclid", "vk_click_id", "rb_clickid", "erid"
]);
const MAX_VALUE_LENGTH = 256;

function clean(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().slice(0, MAX_VALUE_LENGTH);
  return normalized && !/[\u0000-\u001f\u007f]/.test(normalized) ? normalized : null;
}

export function readAttribution(input) {
  const params = input instanceof URLSearchParams
    ? input
    : new URLSearchParams(String(input ?? "").replace(/^\?/, ""));
  const touch = {};
  for (const key of ATTRIBUTION_KEYS) {
    const value = clean(params.get(key));
    if (value) touch[key] = value;
  }
  return Object.keys(touch).length ? touch : null;
}

export function mergeAttribution(previous, current) {
  const incoming = current && typeof current === "object" ? current : null;
  const prior = previous && typeof previous === "object" ? previous : {};
  const firstTouch = prior.firstTouch ?? incoming;
  const lastTouch = incoming ?? prior.lastTouch ?? null;
  return {
    firstTouch: firstTouch ? { ...firstTouch } : null,
    lastTouch: lastTouch ? { ...lastTouch } : null
  };
}

export function createAttributionState(search, previous = null) {
  return mergeAttribution(previous, readAttribution(search));
}

export function attributionToPayload(state) {
  const normalized = mergeAttribution(state, null);
  return {
    first_touch: normalized.firstTouch,
    last_touch: normalized.lastTouch
  };
}
