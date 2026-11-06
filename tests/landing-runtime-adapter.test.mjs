import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { buildLandingProfile, buildCanonicalLandingProfile } from "../scripts/build-landing-runtime.mjs";
import { normalizePassportV1 } from "../src/passport-normalizer-v1.mjs";

const source = {
  url:"https://developer.example/project",
  title:"Официальные сведения",
  accessedAt:"2026-11-01T10:00:00Z",
  quoteOrEvidence:"Подтверждающий фрагмент из официального источника."
};
const passport = () => ({
  schemaVersion:"1.0.0",
  project:{ id:"sample-residence", name:"Sample Residence", location:{ city:"Воронеж", district:{value:"Центр",status:"verified"}, address:{value:"Улица Примерная, 1",status:"verified"} } },
  facts:[
    {id:"f-ok",claim:"Закрытая территория",status:"verified",publicUse:"allowed",sources:[source]},
    {id:"f-expired",claim:"Старая акция",status:"verified",publicUse:"allowed",sources:[source],expiresAt:"2020-01-01T00:00:00Z"},
    {id:"f-private",claim:"Внутреннее",status:"verified",publicUse:"internal_only",sources:[source]}
  ],
  advantages:[
    {id:"a-ok",title:"Закрытая территория",benefit:"Больше приватности",supportingFactIds:["f-ok"],strength:"strong",hook:"Короткая маркетинговая формулировка"},
    {id:"a-bad",title:"Старая акция",benefit:"Выгодная цена",supportingFactIds:["f-expired"],strength:"strong"},
    {id:"a-empty",title:"Без основания",benefit:"Не должно попасть в runtime",supportingFactIds:[],strength:"supporting"}
  ],
  infrastructure:[
    {name:"Парк",category:"park",status:"verified",source,walkingMinutes:5,distanceMeters:350,distanceEvidence:{method:"walking_route",checkedAt:"2026-11-01T10:00:00Z",validUntil:"2027-01-01T00:00:00Z",source}}
  ],
  offers:[{id:"presentation",title:"Получить презентацию",type:"presentation",status:"active",scenarioId:"presentation_request"}],
  assets:{images:[{id:"hero",type:"render",url:"https://cdn.example/hero.webp",status:"approved",projectMatch:"confirmed",rightsStatus:"confirmed"}],maps:[{id:"map-ok",type:"map",url:"https://cdn.example/location-map.webp",status:"approved",projectMatch:"confirmed",rightsStatus:"confirmed",alt:"Карта квартала"}],plans:[]},
  contentStrategy:{coreIdea:"Дом для своего ритма",primaryCta:"presentation",modules:[
    {moduleId:"concept",decision:"include",reason:"Раскрыть идею",order:1},
    {moduleId:"advantages",decision:"include",reason:"Есть факты",order:2,requiredFactIds:["f-ok"]},
    {moduleId:"location",decision:"include",reason:"Есть маршрут",order:3},
    {moduleId:"floor-plans",decision:"include",reason:"Нет подтверждённых планов",order:4,requiredFactIds:["f-expired"]},
    {moduleId:"calculator",decision:"exclude",reason:"Не нужен"}
  ],visualDirection:{theme:"urban-noir"}},
  marketContext:{snapshotAt:"2026-11-06T00:00:00Z",observations:[{id:"market-test",entity:"Конкурент",status:"provisional",sourceReliability:"aggregator",metrics:{averagePricePerSqmRub:123000},sources:[source],limitations:["Не является официальным прайсом"]}]},
  verification:{checkedAt:"2026-11-01T10:00:00Z",factsWithoutSources:[]}
});
const marketing = () => ({
  projectId:"sample-residence",approvalStatus:"approved",
  copy:Object.fromEntries([
    "heroKicker","headline","lead","conceptTitle","conceptCopy","advantagesTitle","advantagesIntro",
    "visualTitle","visualCopy","apartmentsTitle","apartmentsIntro","locationTitle","locationCopy","closingTitle","closingCopy"
  ].map(key=>[key,key+" copy"]))
});

test("builds a public runtime profile from a passport and approved copy",()=>{
  const profile=buildLandingProfile(passport(),marketing(),{}, {now:"2026-11-06T00:00:00Z"});
  assert.equal(profile.mode,"demo");
  assert.equal(profile.project.id,"sample-residence");
  assert.equal(profile.project.address,"Улица Примерная, 1");
  assert.deepEqual(profile.composition,["concept","advantages","location"]);
  assert.equal(profile.advantages.length,1);
  assert.equal(profile.advantages[0].title,"Закрытая территория");
  assert.deepEqual(profile.advantages[0].evidence,[{claim:"Закрытая территория",sourceTitle:"Официальные сведения"}]);
  assert.equal(profile.advantages[0].hook,"Короткая маркетинговая формулировка");
  assert.equal("proof" in profile.advantages[0],false);
  assert.equal(profile.media.length,1);
  assert.equal(profile.media[0].rightsStatus,"approved");
  assert.deepEqual(profile.locationMap,{url:"https://cdn.example/location-map.webp",alt:"Карта квартала",status:"approved",rightsStatus:"approved"});
  assert.equal(profile.infrastructure[0].distanceLabel,"5 мин. пешком");
  assert.equal("commercial" in profile,false);
  assert.equal("facts" in profile,false);
  assert.equal("marketContext" in profile,false);
});

test("does not publish POI names as proximity labels without current distance evidence", () => {
  const p = passport();
  p.infrastructure = [
    { name:"Школа № 9", category:"school", status:"verified", source, publicLabel:"Школа № 9" },
    {
      name:"Парк по прямой", category:"park", status:"verified", source,
      publicLabel:"Парк «Орлёнок»", distanceMeters:350,
      distanceEvidence:{
        method:"straight_line", checkedAt:"2026-11-01T10:00:00Z",
        validUntil:"2027-01-01T00:00:00Z", source
      }
    },
    {
      name:"Маршрут с неверной методикой", category:"park", status:"verified", source,
      distanceMeters:350, walkingMinutes:5,
      distanceEvidence:{
        method:"straight_line", checkedAt:"2026-11-01T10:00:00Z",
        validUntil:"2027-01-01T00:00:00Z", source
      }
    },
    {
      name:"Устаревший маршрут", category:"park", status:"verified", source,
      distanceMeters:500,
      distanceEvidence:{
        method:"walking_route", checkedAt:"2026-01-01T10:00:00Z",
        validUntil:"2026-02-01T00:00:00Z", source
      }
    }
  ];
  const profile = buildLandingProfile(p, marketing(), {}, { now:"2026-11-06T00:00:00Z" });
  assert.deepEqual(profile.infrastructure, [
    { name:"Парк по прямой", category:"park", distanceMeters:350, distanceLabel:"350 м по прямой", status:"verified" }
  ]);
});

test("records a legacy runtime parity baseline alongside normalized project knowledge", () => {
  const input = passport();
  const profile = buildLandingProfile(input, marketing(), {}, { now: "2026-11-06T00:00:00Z" });
  const normalized = normalizePassportV1(input);
  assert.deepEqual(normalized.errors, []);

  assert.deepEqual({
    mode: profile.mode,
    projectId: profile.project.id,
    composition: profile.composition,
    advantageTitles: profile.advantages.map(item => item.title),
    mediaUrls: profile.media.map(item => item.url),
    locationMapUrl: profile.locationMap?.url || null,
    firstWalkingLabel: profile.infrastructure[0].distanceLabel
  }, {
    mode: "demo",
    projectId: "sample-residence",
    composition: ["concept", "advantages", "location"],
    advantageTitles: ["Закрытая территория"],
    mediaUrls: ["https://cdn.example/hero.webp"],
    locationMapUrl: "https://cdn.example/location-map.webp",
    firstWalkingLabel: "5 мин. пешком"
  });

  const normalizedFact = normalized.knowledge.claims.find(item =>
    item.predicate === "project.fact" && item.value.value === profile.advantages[0].evidence[0].claim
  );
  assert.ok(normalizedFact, "the legacy runtime's published advantage must have a normalized claim");
  assert.equal(normalizedFact.epistemicStatus, "verified");
  assert.equal(normalizedFact.publicUse, "allowed");
  assert.equal(normalized.knowledge.sources.find(item => item.id === normalizedFact.sourceIds[0]).title,
    profile.advantages[0].evidence[0].sourceTitle);

  assert.equal(normalized.knowledge.routes.length, 1);
  assert.equal(normalized.knowledge.routes[0].durationSeconds, 300);
  assert.equal(normalized.knowledge.routes[0].distance.value, 350);
  assert.equal(normalized.knowledge.assets.length, 2);
});

test("uses only approved, project-matched and rights-cleared map assets",()=>{
  const p=passport();
  p.assets.maps.push({id:"map-unapproved",type:"map",url:"https://cdn.example/unapproved.webp",status:"approved",projectMatch:"unconfirmed",rightsStatus:"confirmed"});
  const profile=buildLandingProfile(p,marketing(),{}, {now:"2026-11-06T00:00:00Z"});
  assert.equal(profile.locationMap.url,"https://cdn.example/location-map.webp");
  const withoutMap=passport();
  withoutMap.assets.maps=[{id:"map-restricted",type:"map",url:"https://cdn.example/restricted.webp",status:"approved",projectMatch:"confirmed",rightsStatus:"blocked"}];
  assert.equal(buildLandingProfile(withoutMap,marketing()).locationMap,null);
});

test("exposes the three supported gallery compositions and defaults safely",()=>{
  for (const layout of ["mosaic", "editorial", "strip"]) {
    const p = passport();
    p.contentStrategy.visualDirection.galleryLayout = layout;
    assert.equal(buildLandingProfile(p, marketing()).design.galleryLayout, layout);
  }
  const invalid = passport();
  invalid.contentStrategy.visualDirection.galleryLayout = "unimplemented-layout";
  assert.equal(buildLandingProfile(invalid, marketing()).design.galleryLayout, "mosaic");
});

test("exposes the three supported hero compositions and defaults safely",()=>{
  for (const layout of ["split", "fullscreen", "editorial"]) {
    const p = passport();
    p.contentStrategy.visualDirection.heroLayout = layout;
    assert.equal(buildLandingProfile(p,marketing()).design.heroLayout, layout);
  }
  const invalid = passport();
  invalid.contentStrategy.visualDirection.heroLayout = "unimplemented-layout";
  assert.equal(buildLandingProfile(invalid,marketing()).design.heroLayout, "split");
});

test("rejects draft, cross-project or incomplete marketing copy",()=>{
  const copy=marketing(); copy.approvalStatus="draft";
  assert.throws(()=>buildLandingProfile(passport(),copy),/approved/);
  const wrong=marketing(); wrong.projectId="another-project";
  assert.throws(()=>buildLandingProfile(passport(),wrong),/same projectId/);
  const incomplete=marketing(); delete incomplete.copy.headline;
  assert.throws(()=>buildLandingProfile(passport(),incomplete),/headline/);
});

test("rejects marketing claims backed by expired or internal-only facts",()=>{
  const copy=marketing(); copy.claimFactIds={headline:["f-expired"]};
  assert.throws(()=>buildLandingProfile(passport(),copy,{}, {now:"2026-11-06T00:00:00Z"}),/non-publishable fact/);
  const privateCopy=marketing(); privateCopy.claimFactIds={lead:["f-private"]};
  assert.throws(()=>buildLandingProfile(passport(),privateCopy),/non-publishable fact/);
});

test("fails explicitly when a selected eligible module has no runtime implementation",()=>{
  const p=passport();
  p.contentStrategy.modules.push({moduleId:"security",decision:"include",reason:"Есть подтверждённые данные",order:5});
  assert.throws(
    ()=>buildLandingProfile(p,marketing(),{}, {now:"2026-11-06T00:00:00Z"}),
    /Selected module "security" has no runtime implementation/
  );
});

test("keeps unsupported assets and unverified modules out of the profile",()=>{
  const p=passport();
  p.assets.images.push({id:"wrong",type:"render",url:"https://cdn.example/wrong.webp",status:"approved",projectMatch:"unconfirmed",rightsStatus:"confirmed"});
  const profile=buildLandingProfile(p,marketing(),{}, {now:"2026-11-06T00:00:00Z"});
  assert.equal(profile.media.length,1);
  assert.equal(profile.composition.includes("apartments"),false);
});

test("production mode requires an approved positioning brief and public integration settings",()=>{
  assert.throws(()=>buildLandingProfile(passport(),marketing(),{}, {mode:"production"}),/approved LANDING BRIEF/);
  const brief = landingBrief();
  assert.throws(()=>buildLandingProfile(passport(),marketing(),{}, {mode:"production",brief}),/requires HTTPS webhook/);
  const profile=buildLandingProfile(passport(),marketing(),{
    leadEndpoint:"https://hooks.example/lead",privacyPolicyUrl:"https://key.example/privacy",privacyPolicyVersion:"2026-11"
  },{mode:"production",brief});
  assert.equal(profile.mode,"production");
  assert.deepEqual(profile.integration,{leadEndpoint:"https://hooks.example/lead",privacyPolicyUrl:"https://key.example/privacy",privacyPolicyVersion:"2026-11"});
  assert.equal(JSON.stringify(profile).includes("brokerNotes"),false);
  assert.throws(()=>buildLandingProfile(passport(),marketing(),{leadEndpoint:"http://hooks.example/lead"}),/HTTPS/);
});

test("maps approved quiz schema only when the corresponding offer exists",()=>{
  const p=passport();
  p.offers.push({id:"selection",title:"Подбор",type:"apartment_selection",status:"active"});
  p.selectionQuiz={status:"approved",title:"Подбор варианта",questions:[{id:"rooms",label:"Сколько комнат?",options:[{id:"one",label:"Одна"},{id:"two",label:"Две"}]}],resultOfferId:"selection"};
  const profile=buildLandingProfile(p,marketing());
  assert.equal(profile.selectionQuiz.questions[0].id,"rooms");
  assert.equal(profile.offers.quiz.scenarioId,"selection");
});

test("preserves distinct viewing, consultation and callback offers and their canonical IDs",()=>{
  const p=passport();
  p.offers.push(
    {id:"viewing-followup",title:"Записаться на просмотр",type:"viewing",status:"active",scenarioId:"book_viewing"},
    {id:"expert-consultation",title:"Получить консультацию",type:"consultation",status:"active",scenarioId:"expert_consultation"},
    {id:"callback-request",title:"Заказать звонок",type:"callback",status:"active",scenarioId:"callback_request"},
    {id:"other-request",title:"Другой вопрос",type:"other",status:"active",scenarioId:"other_request"}
  );
  const profile=buildLandingProfile(p,marketing());
  assert.equal(profile.offers.viewing.scenarioId,"book_viewing");
  assert.equal(profile.offers.viewing.offerId,"viewing-followup");
  assert.equal(profile.offers.consultation.scenarioId,"expert_consultation");
  assert.equal(profile.offers.consultation.offerId,"expert-consultation");
  assert.equal(profile.offers.callback.scenarioId,"callback_request");
  assert.equal(profile.offers.callback.offerId,"callback-request");
  assert.equal(profile.offers.other.scenarioId,"other_request");
  assert.equal(profile.offers.other.offerId,"other-request");
});

const landingBrief = () => ({
  schemaVersion: "1.0.0",
  projectId: "sample-residence",
  approvalStatus: "approved",
  strategy: {
    coreIdea: "Дом для своего ритма",
    primarySegmentId: "young_professionals",
    primaryHookId: "walkable_daily_needs",
    primaryCtaId: "hero_presentation",
    positioning: {
      audienceSegmentId: "young_professionals",
      primaryNeed: "Удобная повседневная жизнь",
      productFocus: "Квартира в проекте с подтверждённой закрытой территорией",
      primaryTrafficSource: "Поиск Яндекс Директ",
      primaryConverter: "Запросить презентацию проекта",
      rationale: "Проверяемый сценарий для тестового сегмента и подтверждённого оффера",
      statement: "Проект с подтверждённой закрытой территорией",
      supportingFactIds: ["f-ok"],
      gateStatus: "approved",
      status: "approved",
      confidence: "medium",
      evidenceBasis: {
        audience: { type: "research_finding", finding: "Тестовый исследовательский вывод о сегменте" },
        need: { type: "research_finding", finding: "Тестовый исследовательский вывод о потребности" },
        product: { type: "fact", finding: "Закрытая территория подтверждена паспортом" },
        traffic: { type: "research_finding", finding: "Поисковый канал выбран для тестового сценария" },
        converter: { type: "fact", finding: "В паспорте доступен активный сценарий презентации" }
      },
      approvedBy: "product-review",
      approvedAt: "2026-11-06T00:00:00Z"
    }
  },
  segments: [{
    id: "young_professionals", name: "Профессионалы", need: "Удобная повседневная жизнь",
    jtbd: "Выбрать жильё под свой ритм", barriers: [], insightStatus: "hypothesis", priority: "primary"
  }],
  hooks: [{
    id: "walkable_daily_needs", segmentIds: ["young_professionals"], category: "location",
    message: "Закрытая территория", supportingFactIds: ["f-ok"],
    hypothesis: "Конкретный маршрут помогает представить повседневную жизнь", status: "approved"
  }],
  offers: [{
    id: "project_presentation", passportOfferId: "presentation", type: "presentation",
    title: "Получить презентацию", value: "Разобраться в проекте",
    deliverable: "Презентация проекта от KEY", readiness: "ready",
    scenarioId: "presentation_request", segmentIds: ["young_professionals"]
  }],
  funnels: [{
    id: "location_to_presentation", segmentIds: ["young_professionals"],
    hookIds: ["walkable_daily_needs"], offerId: "project_presentation",
    stages: [
      { id: "ad_click", name: "Переход из рекламы", userAction: "Открыть лендинг" },
      { id: "presentation_request", name: "Запрос презентации", userAction: "Оставить контакт" }
    ],
    successEvent: "qualified_presentation_request"
  }],
  ctas: [{
    id: "hero_presentation", label: "Получить презентацию",
    moduleId: "hero", intent: "get_information",
    offerId: "project_presentation", funnelId: "location_to_presentation",
    hookId: "walkable_daily_needs", segmentIds: ["young_professionals"],
    scenarioId: "presentation_request", placement: "hero_primary"
  }],
  qualification: { questions: [], qualitySignals: [], disqualificationRules: [] },
  experiments: []
});

test("approved LANDING BRIEF drives public strategy and a contextual CTA map", () => {
  const profile = buildLandingProfile(passport(), marketing(), {}, {
    now: "2026-11-06T00:00:00Z",
    brief: landingBrief()
  });
  assert.equal(profile.marketingStrategy.coreIdea, "Дом для своего ритма");
  assert.equal(profile.marketingStrategy.primarySegment.id, "young_professionals");
  assert.equal(profile.marketingStrategy.primaryHook.message, "Закрытая территория");
  assert.equal(profile.marketingStrategy.positioning, "Проект с подтверждённой закрытой территорией");
  assert.deepEqual(profile.ctaMap.hero, {
    moduleId: "hero",
    ctaId: "hero_presentation",
    label: "Получить презентацию",
    intent: "get_information",
    offerKey: "presentation",
    offerId: "presentation",
    scenarioId: "presentation_request",
    funnelId: "location_to_presentation",
    hookId: "walkable_daily_needs",
    segmentId: "young_professionals"
  });
});

test("blocks public runtime when the five-part Positioning Gate is not approved", () => {
  const blocked = landingBrief();
  blocked.strategy.positioning.gateStatus = "blocked";
  assert.throws(
    () => buildLandingProfile(passport(), marketing(), {}, { brief: blocked }),
    /Positioning Gate is not approved/
  );
  const incomplete = landingBrief();
  delete incomplete.strategy.positioning.evidenceBasis.traffic;
  assert.throws(
    () => buildLandingProfile(passport(), marketing(), {}, { brief: incomplete }),
    /validated evidence for traffic/
  );
});

test("does not allow draft briefs or unready offers to control the public runtime", () => {
  const draft = landingBrief();
  draft.approvalStatus = "draft";
  assert.throws(() => buildLandingProfile(passport(), marketing(), {}, { brief: draft }), /must be approved/);
  const unready = landingBrief();
  unready.offers[0].readiness = "conditional";
  assert.throws(() => buildLandingProfile(passport(), marketing(), {}, { brief: unready }), /not operationally ready/);
});

test("does not publish an approved hook whose evidence is no longer publishable", () => {
  const brief = landingBrief();
  brief.hooks[0].supportingFactIds = ["f-private"];
  assert.throws(() => buildLandingProfile(passport(), marketing(), {}, { brief }), /supportingFactIds references unknown ID/);
});

test("does not let a CTA use a draft marketing hook", () => {
  const brief = landingBrief();
  brief.hooks.push({ ...brief.hooks[0], id: "draft_hook", status: "hypothesis" });
  brief.funnels.push({ ...brief.funnels[0], id: "draft_funnel", hookIds: ["draft_hook"] });
  brief.ctas.push({
    ...brief.ctas[0],
    id: "closing_presentation",
    moduleId: "closing",
    funnelId: "draft_funnel",
    hookId: "draft_hook"
  });
  assert.throws(
    () => buildLandingProfile(passport(), marketing(), {}, { brief }),
    /hook that is not approved or tested/
  );
});


const canonicalMarketing = projectId => ({
  projectId, approvalStatus:"approved",
  copy:Object.fromEntries([
    "heroKicker","headline","lead","conceptTitle","conceptCopy","advantagesTitle","advantagesIntro",
    "visualTitle","visualCopy","apartmentsTitle","apartmentsIntro","locationTitle","locationCopy",
    "closingTitle","closingCopy"
  ].map(key => [key, key + " copy"])),
  claimFactIds:{}
});

test("canonical CLI builder uses normalized knowledge and the shared module registry", () => {
  const passport = JSON.parse(readFileSync(new URL("../examples/project-passport.example.json", import.meta.url), "utf8"));
  const result = buildCanonicalLandingProfile(passport, canonicalMarketing(passport.project.id), {}, {
    now:"2026-11-06T00:00:00Z"
  });
  assert.equal(result.profile.project.id, passport.project.id);
  assert.equal(result.profile.mode, "demo");
  assert.equal(result.profile.design.palette.paper, "#f0efec");
  assert.ok(result.warnings.some(item => item.code === "CONDITIONAL_MODULE_NOT_READY" && item.moduleId === "floor-plans"));
  assert.equal(result.profile.plans.length, 0);
});

test("canonical CLI builder fails closed for the real KD 905 draft when an included module lacks approved assets", () => {
  const passport = JSON.parse(readFileSync(new URL("../examples/kd-905.project-passport.draft.json", import.meta.url), "utf8"));
  assert.throws(
    () => buildCanonicalLandingProfile(passport, canonicalMarketing(passport.project.id), {}, {
      now:"2026-11-06T00:00:00Z"
    }),
    /Landing module registry rejected the selected strategy/
  );
});

test("canonical CLI builder rejects unknown included modules instead of silently omitting them", () => {
  const passport = JSON.parse(readFileSync(new URL("../examples/project-passport.example.json", import.meta.url), "utf8"));
  passport.contentStrategy.modules.push({moduleId:"invented-section",decision:"include",variant:"default",order:9});
  assert.throws(
    () => buildCanonicalLandingProfile(passport, canonicalMarketing(passport.project.id)),
    /Модуль "invented-section" отсутствует в Module Registry/
  );
});
