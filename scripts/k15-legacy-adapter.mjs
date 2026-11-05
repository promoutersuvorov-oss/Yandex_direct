/**
 * K15 legacy boundary adapter.
 *
 * This module deliberately does NOT turn K15 data into a public passport.
 * It extracts reusable behavior/configuration into explicit, reviewable
 * runtime boundaries. Secrets and project-specific values are never copied
 * into a public profile.
 */

const own = (object, key) =>
  Object.prototype.hasOwnProperty.call(object ?? {}, key);

const text = value =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const finiteNumber = value => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const ALLOWED_CONTACT_CHANNELS = new Set(["call", "telegram", "max", "vk"]);

export function normalizeAttribution(current = {}, previous = {}) {
  const keys = [
    "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
    "yclid", "ysclid", "gclid", "erid", "rb_clickid"
  ];
  const pick = source => Object.fromEntries(
    keys.map(key => [key, text(source?.[key])]).filter(([, value]) => value !== null)
  );

  const firstTouch = Object.keys(previous?.firstTouch ?? {}).length
    ? pick(previous.firstTouch)
    : pick(current);
  const lastTouch = Object.keys(pick(current)).length
    ? pick(current)
    : pick(previous?.lastTouch);

  return { firstTouch, lastTouch };
}

export function mapK15LegacyConfig(config = {}) {
  const vars = config.vars ?? {};
  const bots = config.bots ?? {};
  const social = config.social ?? {};
  const company = config.company ?? {};

  const latitude = finiteNumber(config.mapLat);
  const longitude = finiteNumber(config.mapLon);
  const coordinates = latitude !== null && longitude !== null &&
    latitude >= -90 && latitude <= 90 &&
    longitude >= -180 && longitude <= 180
    ? { lat: latitude, lng: longitude }
    : null;

  const contacts = {
    phone: text(config.phone),
    address: text(config.address),
    telegram: text(bots.telegram),
    max: text(bots.max),
    vk: text(bots.vk),
    social: Object.fromEntries(
      Object.entries(social).filter(([, value]) =>
        typeof value === "string" && /^https:\/\//i.test(value.trim())
      )
    )
  };

  const project = {
    coordinates,
    cityMapProviderSlug: text(config.mapCity2gis),
    developerLegalIdentity: {
      name: text(company.name),
      inn: text(company.inn),
      ogrn: text(company.ogrn)
    }
  };

  const runtime = {
    workSchedule: text(config.workSchedule),
    workHours: text(config.workHours),
    callbackSla: text(config.callbackSla),
    mapTileUrl: text(config.mapTileUrl),
    mapTiles: Array.isArray(config.mapTiles) ? config.mapTiles : [],
    imagePath: text(config.imgPath),
    showSlotLabels: config.showSlotLabels === true
  };

  const integrations = {
    // Intentionally no endpoint URL or provider IDs in the client-facing object.
    leadEndpointConfigured: Boolean(text(config.endpoint)),
    analytics: {
      metrikaConfigured: Boolean(text(config.metrikaId)),
      vkPixelConfigured: Boolean(text(config.vkPixelId))
    },
    messengerConfigured: Object.fromEntries(
      Object.entries({ telegram: bots.telegram, max: bots.max, vk: bots.vk })
        .map(([key, value]) => [key, Boolean(text(value) && text(value) !== "#")])
    )
  };

  const commercial = {
    formats: Array.isArray(config.formats) ? config.formats : [],
    priceFrom: text(vars.PRICE_FROM),
    paymentFrom: text(vars.PAYMENT_FROM),
    paymentNote: text(vars.PAYMENT_NOTE),
    deliveryDate: text(vars.DELIVERY_DATE),
    installmentPercent: text(vars.INSTALLMENT_PCT),
    parkingTerms: text(vars.PARKING_TERMS),
    apartmentType: text(vars.APT_TYPE),
    apartmentArea: text(vars.APT_AREA),
    callbackSla: text(config.callbackSla),
    presentationConfigured: Boolean(text(config.presentationUrl)),
    checklistConfigured: Boolean(text(config.checklistUrl))
  };

  return {
    adapterVersion: "1.0.0",
    project,
    contacts,
    runtime,
    integrations,
    commercial,
    security: {
      endpointWithheld: own(config, "endpoint"),
      metrikaIdWithheld: own(config, "metrikaId"),
      vkPixelIdWithheld: own(config, "vkPixelId"),
      privacyUrlWithheld: own(config, "privacyUrl")
    }
  };
}

export function buildCanonicalLeadPayload(input = {}) {
  const name = text(input.name);
  const phone = text(input.phone);
  const channel = text(input.preferredChannel);
  if (!name) throw new TypeError("Lead name is required.");
  if (!phone) throw new TypeError("Lead phone is required.");
  if (!input.consent?.accepted) throw new TypeError("Lead consent is required.");
  if (!ALLOWED_CONTACT_CHANNELS.has(channel)) {
    throw new TypeError("Unsupported preferred contact channel.");
  }

  return {
    schemaVersion: "1.0.0",
    eventId: text(input.eventId),
    leadId: text(input.leadId),
    projectId: text(input.projectId),
    createdAt: text(input.createdAt),
    pageUrl: text(input.pageUrl),
    referrer: text(input.referrer),
    contact: {
      name,
      phone,
      preferredChannel: channel,
      preferredTime: text(input.preferredTime)
    },
    consent: {
      accepted: true,
      policyVersion: text(input.consent.policyVersion),
      acceptedAt: text(input.consent.acceptedAt),
      policyUrl: text(input.consent.policyUrl)
    },
    conversion: {
      scenarioId: text(input.scenarioId),
      offerId: text(input.offerId),
      moduleId: text(input.moduleId),
      entityContext: input.entityContext && typeof input.entityContext === "object"
        ? structuredClone(input.entityContext)
        : {}
    },
    qualification: {
      answers: input.answers && typeof input.answers === "object"
        ? structuredClone(input.answers)
        : {}
    },
    attribution: normalizeAttribution(input.attribution?.current, input.attribution)
  };
}
