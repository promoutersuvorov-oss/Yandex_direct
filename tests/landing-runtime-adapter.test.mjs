import assert from "node:assert/strict";
import test from "node:test";
import { buildLandingProfile } from "../scripts/build-landing-runtime.mjs";

const source = { url:"https://developer.example/project", title:"Официальные сведения", accessedAt:"2026-11-01T10:00:00Z" };
const passport = () => ({
  schemaVersion:"1.0.0",
  project:{ id:"sample-residence", name:"Sample Residence", location:{ city:"Воронеж", district:{value:"Центр",status:"verified"}, address:{value:"Улица Примерная, 1",status:"verified"} } },
  facts:[
    {id:"f-ok",claim:"Закрытая территория",status:"verified",publicUse:"allowed",sources:[source]},
    {id:"f-expired",claim:"Старая акция",status:"verified",publicUse:"allowed",sources:[source],expiresAt:"2020-01-01T00:00:00Z"},
    {id:"f-private",claim:"Внутреннее",status:"verified",publicUse:"internal_only",sources:[source]}
  ],
  advantages:[
    {id:"a-ok",title:"Закрытая территория",benefit:"Больше приватности",supportingFactIds:["f-ok"],strength:"strong"},
    {id:"a-bad",title:"Старая акция",benefit:"Выгодная цена",supportingFactIds:["f-expired"],strength:"strong"}
  ],
  infrastructure:[
    {name:"Парк",category:"park",status:"verified",source,walkingMinutes:5,distanceMeters:350,distanceEvidence:{method:"walking_route",checkedAt:"2026-11-01T10:00:00Z",validUntil:"2027-01-01T00:00:00Z",source}}
  ],
  offers:[{id:"presentation",title:"Получить презентацию",type:"presentation",status:"active",scenarioId:"presentation_request"}],
  assets:{images:[{id:"hero",type:"render",url:"https://cdn.example/hero.webp",status:"approved",projectMatch:"confirmed",rightsStatus:"confirmed"}],plans:[]},
  contentStrategy:{coreIdea:"Дом для своего ритма",primaryCta:"presentation",modules:[
    {moduleId:"concept",decision:"include",reason:"Раскрыть идею",order:1},
    {moduleId:"advantages",decision:"include",reason:"Есть факты",order:2,requiredFactIds:["f-ok"]},
    {moduleId:"location",decision:"include",reason:"Есть маршрут",order:3},
    {moduleId:"floor-plans",decision:"include",reason:"Нет подтверждённых планов",order:4,requiredFactIds:["f-expired"]},
    {moduleId:"calculator",decision:"exclude",reason:"Не нужен"}
  ],visualDirection:{theme:"urban-noir"}},
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
  assert.equal(profile.media.length,1);
  assert.equal(profile.media[0].rightsStatus,"approved");
  assert.equal(profile.infrastructure[0].distanceLabel,"5 мин. пешком");
  assert.equal("commercial" in profile,false);
  assert.equal("facts" in profile,false);
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

test("keeps unsupported assets and unverified modules out of the profile",()=>{
  const p=passport();
  p.assets.images.push({id:"wrong",type:"render",url:"https://cdn.example/wrong.webp",status:"approved",projectMatch:"unconfirmed",rightsStatus:"confirmed"});
  const profile=buildLandingProfile(p,marketing(),{}, {now:"2026-11-06T00:00:00Z"});
  assert.equal(profile.media.length,1);
  assert.equal(profile.composition.includes("apartments"),false);
});

test("production mode requires public integration settings and never exposes passport internals",()=>{
  assert.throws(()=>buildLandingProfile(passport(),marketing(),{}, {mode:"production"}),/requires HTTPS webhook/);
  const profile=buildLandingProfile(passport(),marketing(),{
    leadEndpoint:"https://hooks.example/lead",privacyPolicyUrl:"https://key.example/privacy",privacyPolicyVersion:"2026-11"
  },{mode:"production"});
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
      statement: "Проект с подтверждённой закрытой территорией",
      supportingFactIds: ["f-ok"],
      status: "approved"
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
  assert.equal(profile.marketingStrategy.positioning, "Проект с подтверждённой повседневной инфраструктурой");
  assert.deepEqual(profile.ctaMap.hero, {
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
  assert.throws(() => buildLandingProfile(passport(), marketing(), {}, { brief }), /non-publishable fact/);
});
