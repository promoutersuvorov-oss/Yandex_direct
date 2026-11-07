import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { normalizePassportV1 } from "../src/passport-normalizer-v1.mjs";
import { normalizeLandingInputsV1 } from "../src/landing-inputs-normalizer-v1.mjs";
import { buildLandingProfileFromKnowledge, buildLandingProfileFromKnowledgeWithDiagnostics } from "../src/landing-runtime-builder-v1.mjs";

const copy = Object.fromEntries([
  "heroKicker","headline","lead","conceptTitle","conceptCopy","advantagesTitle","advantagesIntro",
  "visualTitle","visualCopy","apartmentsTitle","apartmentsIntro","locationTitle","locationCopy","closingTitle","closingCopy"
].map(key => [key, key]));
const marketing = { projectId:"p1", approvalStatus:"approved", copy, claimFactIds:{headline:["f1"]} };
function input() {
  const source={id:"s1",title:"Официальный источник"};
  const evidence={id:"e1",sourceId:"s1",extract:"Подтверждение"};
  const claim={id:"c1",subject:{type:"project",id:"p1"},predicate:"project.fact",value:{kind:"text",value:"Факт"},
    epistemicStatus:"verified",publicUse:"allowed",sourceIds:["s1"],evidenceIds:["e1"],limitations:[]};
  return {
    knowledge:{contractVersion:"0.1",project:{id:"p1",name:"Дом",city:"Воронеж",organizationIds:[]},
      sources:[source],evidence:[evidence],claims:[claim],assets:[],plans:[],pointsOfInterest:[],routes:[]},
    landingInputs:{projectId:"p1",strategy:{modules:[{moduleId:"about",decision:"include",variant:"feature-led",requiredFactIds:["f1"],order:0}]},
      design:{theme:"urban-noir",heroLayout:"split",galleryLayout:"mosaic"},
      marketingCandidates:[{id:"a1",title:"Преимущество",benefit:"Польза",strength:"strong",supportingFactIds:["f1"],classification:"marketing_candidate"}],
      conversionCatalog:[{id:"o1",title:"Презентация",type:"presentation",status:"active",scenarioId:"presentation",consentRequired:true,requiredFields:["preferredChannel","preferredTime"]}],
      selectionFlow:null},
    refs:{factIdToClaimId:{f1:"c1"}}
  };
}
test("builds a demo profile from normalized inputs and keeps marketing candidates evidence-gated",()=>{
  const x=input();const profile=buildLandingProfileFromKnowledge(x.knowledge,x.landingInputs,x.refs,marketing,{},{now:"2026-11-06T00:00:00Z"});
  assert.equal(profile.project.id,"p1");assert.equal(profile.mode,"demo");
  assert.deepEqual(profile.composition,["concept"]);
  assert.equal(profile.advantages.length,1);assert.equal(profile.offers.presentation.offerId,"o1");
  assert.deepEqual(profile.offers.presentation.requiredFields,["name","phone","preferredChannel","preferredTime"]);
});
test("fails closed on claims requiring publication qualification until qualified copy is rendered",()=>{
  const x=input();
  x.knowledge.claims[0].publicUse="allowed_with_qualification";
  x.knowledge.claims[0].limitations=["Указано застройщиком; характеристики могут измениться."];
  assert.throws(
    ()=>buildLandingProfileFromKnowledge(x.knowledge,x.landingInputs,x.refs,marketing,{},{now:"2026-11-06T00:00:00Z"}),
    /non-publishable fact/,
    "A claim requiring qualification must not be inserted into visitor-facing copy without a rendered qualifier."
  );
  const approved=input();
  approved.knowledge.claims[0].publicUse="allowed_with_qualification";
  approved.knowledge.claims[0].limitations=["Характеристики могут измениться."];
  const qualifiedMarketing={...marketing,claimQualifications:{headline:[{factId:"f1",text:"Сведения указаны по данным застройщика; характеристики могут измениться."}]}};
  approved.landingInputs.strategy.modules=[];
  const qualifiedProfile=buildLandingProfileFromKnowledge(approved.knowledge,approved.landingInputs,approved.refs,qualifiedMarketing,{},{now:"2026-11-06T00:00:00Z"});
  assert.deepEqual(qualifiedProfile.marketingQualifications.headline,["Сведения указаны по данным застройщика; характеристики могут измениться."]);
  assert.equal(qualifiedProfile.marketing.headline,marketing.copy.headline);
  assert.equal(qualifiedProfile.advantages.length,0,"A headline qualification must not publish the same claim as an unqualified advantage.");
  const faqLeak=input();
  faqLeak.knowledge.claims[0].publicUse="allowed_with_qualification";
  faqLeak.knowledge.claims[0].limitations=["Характеристики могут измениться."];
  faqLeak.landingInputs.strategy.modules=[{moduleId:"faq",decision:"include",variant:"faq-accordion",order:8,requiredFactIds:["f1"]}];
  faqLeak.landingInputs.faqDrafts=[{id:"faq-qualified",question:"Что известно?",requiredFactIds:["f1"],publicationStatus:"approved"}];
  assert.throws(
    ()=>buildLandingProfileFromKnowledge(faqLeak.knowledge,faqLeak.landingInputs,faqLeak.refs,qualifiedMarketing,{},{now:"2026-11-06T00:00:00Z"}),
    /approved-faq-answers/,
    "A marketing-copy qualification must not authorize the same claim in an FAQ."
  );
  assert.throws(
    ()=>buildLandingProfileFromKnowledge(approved.knowledge,approved.landingInputs,approved.refs,{
      ...qualifiedMarketing,claimFactIds:{headline:["f1"],conceptCopy:["f1"]}
    },{},{now:"2026-11-06T00:00:00Z"}),
    /Marketing claim conceptCopy references non-publishable fact/,
    "A qualification on headline must not authorize the same fact in conceptCopy."
  );
  assert.throws(
    ()=>buildLandingProfileFromKnowledge(approved.knowledge,approved.landingInputs,approved.refs,{
      ...qualifiedMarketing,claimQualifications:{headline:[
        {factId:"f1",text:"Первая оговорка."},{factId:"f1",text:"Другая оговорка."}
      ]}
    },{},{now:"2026-11-06T00:00:00Z"}),
    /must be unique per fact/
  );
  const duplicateClaim=input();
  duplicateClaim.knowledge.claims[0].publicUse="allowed_with_qualification";
  duplicateClaim.knowledge.claims[0].limitations=["Характеристики могут измениться."];
  duplicateClaim.refs.factIdToClaimId.f1Alias="c1";
  assert.throws(
    ()=>buildLandingProfileFromKnowledge(duplicateClaim.knowledge,duplicateClaim.landingInputs,duplicateClaim.refs,{
      ...qualifiedMarketing,
      claimFactIds:{headline:["f1","f1Alias"]},
      claimQualifications:{headline:[
        {factId:"f1",text:"Первая оговорка."},{factId:"f1Alias",text:"Вторая оговорка."}
      ]}
    },{},{now:"2026-11-06T00:00:00Z"}),
    /must be unique per claim/
  );
  const emptyLimitations=input();
  emptyLimitations.knowledge.claims[0].publicUse="allowed_with_qualification";
  emptyLimitations.knowledge.claims[0].limitations=["   "];
  assert.throws(
    ()=>buildLandingProfileFromKnowledge(emptyLimitations.knowledge,emptyLimitations.landingInputs,emptyLimitations.refs,qualifiedMarketing,{},{now:"2026-11-06T00:00:00Z"}),
    /non-empty qualification limitations/
  );
  assert.throws(
    ()=>buildLandingProfileFromKnowledge(approved.knowledge,approved.landingInputs,approved.refs,{...qualifiedMarketing,claimQualifications:{headline:[{factId:"missing",text:"Оговорка"}]}},{},{now:"2026-11-06T00:00:00Z"}),
    /must identify a mapped fact/
  );
  const y=input();
  y.knowledge.claims[0].publicUse="internal_only";
  assert.throws(()=>buildLandingProfileFromKnowledge(y.knowledge,y.landingInputs,y.refs,marketing,{},{}),/non-publishable fact/);
});
test("a source-backed POI name renders without route metrics; marketing qualifications do not create proximity claims",()=>{
  const x=input();
  x.landingInputs.strategy.modules=[];
  x.knowledge.claims[0].publicUse="allowed_with_qualification";
  x.knowledge.claims[0].limitations=["Указано в источнике; сведения могут измениться."];
  // Reuse the exact same qualified claim as a POI existence claim: a copy-field
  // exception must not leak into the infrastructure renderer.
  x.knowledge.claims[0].subject={type:"poi",id:"poi-1"};
  x.knowledge.claims[0].predicate="poi.listed_by_source";
  x.knowledge.pointsOfInterest=[{id:"poi-1",name:"Городской парк",claimIds:["c1"]}];
  const qualifiedMarketing={...marketing,claimQualifications:{headline:[{factId:"f1",text:"По данным источника; сведения могут измениться."}]}};
  const profile=buildLandingProfileFromKnowledge(x.knowledge,x.landingInputs,x.refs,qualifiedMarketing,{},{now:"2026-11-06T00:00:00Z"});
  assert.equal(profile.infrastructure.length,1);
  assert.equal(profile.infrastructure[0].name,"Городской парк");
  assert.equal(profile.infrastructure[0].distanceLabel,undefined);
  assert.match(profile.infrastructure[0].qualification,/расстояние и маршрут отдельно не подтверждены/);
});

test("infrastructure requires a project-scoped route with linked evidence",()=>{
  const x=input();
  x.landingInputs.strategy.modules=[];
  x.knowledge.claims[0].subject={type:"poi",id:"poi-1"};
  x.knowledge.claims[0].predicate="poi.listed_by_source";
  x.knowledge.pointsOfInterest=[{id:"poi-1",name:"Городской парк",claimIds:["c1"]}];
  x.knowledge.sources.push({id:"s2",title:"Источник маршрута"});
  x.knowledge.evidence.push({id:"e2",sourceId:"s2",extract:"Проверенный пешеходный маршрут"});
  x.knowledge.routes=[{id:"route-1",originRef:{type:"project",id:"p1"},destinationPoiId:"poi-1",method:"route",mode:"walking",
    observedAt:"2026-11-05T12:00:00Z",validUntil:"2027-11-05T12:00:00Z",sourceIds:["s2"],evidenceIds:["e2"],durationSeconds:300}];
  const valid=buildLandingProfileFromKnowledge(x.knowledge,x.landingInputs,x.refs,marketing,{},{now:"2026-11-06T00:00:00Z"});
  assert.equal(valid.infrastructure.length,1);
  assert.equal(valid.infrastructure[0].distanceLabel,"5 мин. пешком");
  const missingEvidence=structuredClone(x);
  missingEvidence.knowledge.routes[0].evidenceIds=[];
  const blocked=buildLandingProfileFromKnowledge(missingEvidence.knowledge,missingEvidence.landingInputs,missingEvidence.refs,marketing,{},{now:"2026-11-06T00:00:00Z"});
  assert.equal(blocked.infrastructure.length,1);
  assert.equal(blocked.infrastructure[0].distanceLabel,undefined);
  const wrongProject=structuredClone(x);
  wrongProject.knowledge.routes[0].originRef.id="another-project";
  const wrongOrigin=buildLandingProfileFromKnowledge(wrongProject.knowledge,wrongProject.landingInputs,wrongProject.refs,marketing,{},{now:"2026-11-06T00:00:00Z"});
  assert.equal(wrongOrigin.infrastructure.length,1);
  assert.equal(wrongOrigin.infrastructure[0].distanceLabel,undefined);
});

test("blocks claims without linked source/evidence and candidates with missing facts",()=>{
  const x=input();x.knowledge.evidence=[];
  assert.throws(()=>buildLandingProfileFromKnowledge(x.knowledge,x.landingInputs,x.refs,marketing,{},{}),/non-publishable fact/);
  const y=input();y.landingInputs.marketingCandidates[0].supportingFactIds=["missing"];
  const profile=buildLandingProfileFromKnowledge(y.knowledge,y.landingInputs,y.refs,marketing,{},{});
  assert.equal(profile.advantages.length,0);
});
test("rejects missing ID bridge, project mismatch, unsupported module and incomplete production setup",()=>{
  const x=input();
  assert.throws(()=>buildLandingProfileFromKnowledge(x.knowledge,x.landingInputs,null,marketing,{},{}),/bridge/);
  assert.throws(()=>buildLandingProfileFromKnowledge(x.knowledge,{...x.landingInputs,projectId:"p2"},x.refs,marketing,{},{}),/match/);
  const y=input();y.landingInputs.strategy.modules=[{moduleId:"unknown",decision:"include"}];
  assert.throws(()=>buildLandingProfileFromKnowledge(y.knowledge,y.landingInputs,y.refs,marketing,{},{}),/Module Registry/);
  const z=input();assert.throws(()=>buildLandingProfileFromKnowledge(z.knowledge,z.landingInputs,z.refs,marketing,{}, {mode:"production"}),/approved marketing strategy/);
});
test("does not publish unapproved assets, expired claims, or invalid integration URLs",()=>{
  const x=input();x.knowledge.assets=[{id:"render",assetKind:"render",url:"https://example.test/a.jpg",alt:"",publicationStatus:"pending",
    projectMatch:"confirmed",rightsStatus:"confirmed",rightsEvidenceIds:["e1"],allowedContexts:[]}];
  const profile=buildLandingProfileFromKnowledge(x.knowledge,x.landingInputs,x.refs,marketing,{},{});
  assert.equal(profile.media.length,0);
  assert.throws(()=>buildLandingProfileFromKnowledge(x.knowledge,x.landingInputs,x.refs,marketing,{leadEndpoint:"http://bad"},{}),/HTTPS/);
});
test("does not expose internal knowledge or secret integration values in demo profile",()=>{
  const x=input();x.knowledge.internalMarketContext={private:true};
  const profile=buildLandingProfileFromKnowledge(x.knowledge,x.landingInputs,x.refs,marketing,{leadEndpoint:"https://secret.test"}, {mode:"demo"});
  assert.equal(JSON.stringify(profile).includes("private"),false);
  assert.equal(profile.integration.leadEndpoint,"");
});

test("does not publish an asset associated with a different project",()=>{
  const x=input();x.knowledge.assets=[{id:"render",assetKind:"render",url:"https://example.test/a.jpg",publicationStatus:"approved",
    projectMatch:"confirmed",rightsStatus:"confirmed",rightsEvidenceIds:["e1"],subjectRefs:[{type:"project",id:"another-project"}],allowedContexts:[]}];
  const profile=buildLandingProfileFromKnowledge(x.knowledge,x.landingInputs,x.refs,marketing,{},{});
  assert.equal(profile.media.length,0);
});
test("quiz result must resolve to the actual quiz offer",()=>{
  const x=input();
  x.landingInputs.conversionCatalog.push({id:"quiz-offer",title:"Квиз",type:"apartment_selection",status:"active",consentRequired:true});
  x.landingInputs.selectionFlow={publicEligible:true,title:"Подбор",resultOfferId:"o1",questions:[]};
  const profile=buildLandingProfileFromKnowledge(x.knowledge,x.landingInputs,x.refs,marketing,{},{});
  assert.equal(profile.selectionQuiz,null);
});

test("builds the real KD 905 draft with a qualified advantage and named POIs but no invented metrics or assets",()=>{
  const passport=JSON.parse(readFileSync(new URL("../examples/kd-905.project-passport.draft.json",import.meta.url),"utf8"));
  const normalized=normalizePassportV1(passport);
  const landing=normalizeLandingInputsV1(passport);
  assert.deepEqual(normalized.errors,[]);
  assert.deepEqual(landing.errors,[]);
  // Keep the real passport facts and scoped qualification, but select only the
  // modules whose exact runtime content is currently supported by this evidence.
  landing.landingInputs.strategy.modules=[
    {moduleId:"hero",decision:"include",reason:"Identity only",order:0,variant:"editorial-split",requiredFactIds:[]},
    {moduleId:"security",decision:"include",reason:"Qualified parking card",order:1,variant:"proof-led",requiredFactIds:["underground-parking"]},
    {moduleId:"location",decision:"include",reason:"Source-backed place names",order:2,variant:"location-led",requiredFactIds:[]},
    {moduleId:"gallery",decision:"conditional",reason:"No approved media",order:3,variant:"immersive",requiredFactIds:[],dependencies:["approved-project-media"]}
  ];
  const copy=Object.fromEntries(Object.keys(marketing.copy).map(key=>[key,key]));
  const approvedCopy={projectId:passport.project.id,approvalStatus:"approved",copy,claimFactIds:{}};
  const result=buildLandingProfileFromKnowledgeWithDiagnostics(
    normalized.knowledge,landing.landingInputs,normalized.legacyReferences,approvedCopy,{},{now:"2026-11-07T00:00:00Z"}
  );
  assert.ok(result.profile.advantages.some(item=>item.id==="parking-functionality"));
  const parking=result.profile.advantages.find(item=>item.id==="parking-functionality");
  assert.equal(parking.evidence[0].claim,"В проекте предусмотрен подземный паркинг.");
  assert.match(parking.evidence[0].qualification,/наличие свободных мест/);
  assert.ok(result.profile.infrastructure.some(item=>item.name==="Детский сад № 108"));
  assert.ok(result.profile.infrastructure.some(item=>item.name==="Парк «Орлёнок»"));
  assert.ok(result.profile.infrastructure.every(item=>item.distanceLabel===undefined && item.distanceMeters===undefined));
  assert.deepEqual(result.profile.media,[]);
  assert.deepEqual(result.profile.plans,[]);
  assert.ok(result.warnings.some(item=>item.code==="POI_METRIC_NOT_PUBLISHED"));
  assert.ok(result.warnings.some(item=>item.code==="CONDITIONAL_MODULE_NOT_READY" && item.moduleId==="lifestyle"));
  assert.equal(result.profile.mode,"demo");
});

test("apartment plans require an asset explicitly cleared for the floor-plans context",()=>{
  const x=input();
  x.knowledge.assets=[{id:"plan-asset",assetKind:"plan",url:"https://assets.example.test/plan.svg",
    publicationStatus:"approved",projectMatch:"confirmed",rightsStatus:"confirmed",rightsEvidenceIds:["e1"],
    subjectRefs:[{type:"project",id:"p1"}],allowedContexts:["floor-plans"]}];
  x.knowledge.plans=[{id:"plan-1",planKind:"apartment_floor_plan",epistemicStatus:"verified",publicUse:"allowed",
    sourceIds:["s1"],evidenceIds:["e1"],rooms:2,area:{value:58,unit:"m2"},assetId:"plan-asset",
    validUntil:"2027-11-06T00:00:00Z"}];
  const allowed=buildLandingProfileFromKnowledge(x.knowledge,x.landingInputs,x.refs,marketing,{},{now:"2026-11-06T00:00:00Z"});
  assert.equal(allowed.plans.length,1);
  const restricted=structuredClone(x);
  restricted.knowledge.assets[0].allowedContexts=["gallery"];
  const blocked=buildLandingProfileFromKnowledge(restricted.knowledge,restricted.landingInputs,restricted.refs,marketing,{},{now:"2026-11-06T00:00:00Z"});
  assert.deepEqual(blocked.plans,[]);
});

test("conditional gallery and floor plans are omitted when their capabilities are unavailable",()=>{
  const x=input();
  x.landingInputs.strategy.modules=[
    {moduleId:"gallery",decision:"conditional",variant:"immersive",order:1},
    {moduleId:"floor-plans",decision:"conditional",variant:"plan-selector",order:2}
  ];
  const result=buildLandingProfileFromKnowledgeWithDiagnostics(x.knowledge,x.landingInputs,x.refs,marketing,{},{});
  assert.deepEqual(result.profile.composition,[]);
  assert.equal(result.profile.media.length,0);
  assert.equal(result.profile.plans.length,0);
  assert.deepEqual(result.warnings.map(item=>item.moduleId),["gallery","floor-plans"]);
});
test("required included module fails when its exact runtime variant or capability is unavailable",()=>{
  const x=input();
  x.landingInputs.strategy.modules=[{moduleId:"lifestyle",decision:"include",variant:"image-led",order:1}];
  assert.throws(()=>buildLandingProfileFromKnowledge(x.knowledge,x.landingInputs,x.refs,marketing,{},{}),/approved-lifestyle-stories/);
});

test("registered hero variant overrides descriptive layout input deterministically",()=>{
  const x=input();
  x.landingInputs.strategy.modules=[{moduleId:"hero",decision:"include",variant:"editorial-split",order:0}];
  x.landingInputs.design.heroLayout="fullscreen";
  const profile=buildLandingProfileFromKnowledge(x.knowledge,x.landingInputs,x.refs,marketing,{},{});
  assert.equal(profile.design.heroLayout,"split");
});

test("production mode requires a verified lead API workflow and explicit offers, not demo defaults",()=>{
  const x=input();
  const strategy={approvalStatus:"approved",ctaMap:{}};
  const integration={leadEndpoint:"https://api.example.test/leads",privacyPolicyUrl:"https://example.test/privacy",
    privacyPolicyVersion:"v1"};
  assert.throws(()=>buildLandingProfileFromKnowledge(x.knowledge,x.landingInputs,x.refs,marketing,integration,
    {mode:"production",approvedMarketingStrategy:strategy}),/verified API delivery contract/);
});
test("offers without explicit consent are not eligible for runtime",()=>{
  const x=input();
  x.landingInputs.conversionCatalog[0].consentRequired=false;
  const profile=buildLandingProfileFromKnowledge(x.knowledge,x.landingInputs,x.refs,marketing,{},{});
  assert.equal(profile.offers.presentation.scenarioId,"presentation_request");
  assert.equal(profile.offers.presentation.offerId,undefined);
});

test("publishes lifestyle stories only with approved copy, publishable claims and lifestyle-cleared project assets",()=>{
  const x=input();
  x.knowledge.assets=[{id:"courtyard-render",assetKind:"render",url:"https://example.test/courtyard.jpg",
    publicationStatus:"approved",projectMatch:"confirmed",rightsStatus:"confirmed",rightsEvidenceIds:["e1"],
    subjectRefs:[{type:"project",id:"p1"}],allowedContexts:["lifestyle"]}];
  x.landingInputs.strategy.modules=[{moduleId:"lifestyle",decision:"include",variant:"image-led",order:1,requiredFactIds:["f1"]}];
  x.landingInputs.lifestyleStories=[{id:"courtyard-morning",title:"Утро во дворе",
    description:"Сценарий на основе подтверждённой особенности проекта.",sceneLabel:"ДВОР",
    assetId:"courtyard-render",supportingFactIds:["f1"],publicationStatus:"approved"}];
  const profile=buildLandingProfileFromKnowledge(x.knowledge,x.landingInputs,x.refs,marketing,{},{});
  assert.deepEqual(profile.composition,["lifestyle"]);
  assert.equal(profile.lifestyleStories.length,1);
  assert.equal(profile.lifestyleStories[0].assetUrl,"https://example.test/courtyard.jpg");
  const noRights=input();
  noRights.knowledge.assets=[{id:"courtyard-render",assetKind:"render",url:"https://example.test/courtyard.jpg",
    publicationStatus:"approved",projectMatch:"confirmed",rightsStatus:"confirmed",rightsEvidenceIds:[],
    subjectRefs:[{type:"project",id:"p1"}],allowedContexts:["lifestyle"]}];
  noRights.landingInputs.strategy.modules=[{moduleId:"lifestyle",decision:"include",variant:"image-led",order:1}];
  noRights.landingInputs.lifestyleStories=x.landingInputs.lifestyleStories;
  assert.throws(()=>buildLandingProfileFromKnowledge(noRights.knowledge,noRights.landingInputs,noRights.refs,marketing,{},{}),/approved-lifestyle-stories/);
});

test("FAQ answers are composed only from publishable required claims and their source titles",()=>{
  const x=input();
  x.landingInputs.strategy.modules=[{moduleId:"faq",decision:"include",variant:"faq-accordion",order:8,requiredFactIds:["f1"]}];
  x.landingInputs.faqDrafts=[{id:"faq-1",question:"Что известно о проекте?",requiredFactIds:["f1"],publicationStatus:"approved"}];
  const profile=buildLandingProfileFromKnowledge(x.knowledge,x.landingInputs,x.refs,marketing,{},{now:"2026-11-06T00:00:00Z"});
  assert.deepEqual(profile.composition,["faq"]);
  assert.deepEqual(profile.faqItems,[{id:"faq-1",question:"Что известно о проекте?",
    answer:[{factId:"f1",claim:"Факт",sourceTitle:"Официальный источник"}]}]);
  const blocked=input();
  blocked.landingInputs.strategy.modules=[{moduleId:"faq",decision:"include",variant:"faq-accordion",order:8}];
  blocked.landingInputs.faqDrafts=[{id:"faq-2",question:"Можно ли подтвердить это?",requiredFactIds:["missing"],publicationStatus:"approved"}];
  assert.throws(()=>buildLandingProfileFromKnowledge(blocked.knowledge,blocked.landingInputs,blocked.refs,marketing,{},{}),/approved-faq-answers/);
});

test("FAQ qualifications are scoped to the exact approved answer and never leak to other modules", () => {
  const x = input();
  x.knowledge.claims[0].publicUse = "allowed_with_qualification";
  x.knowledge.claims[0].limitations = ["Характеристика указана в материалах застройщика."];
  x.landingInputs.strategy.modules = [
    { moduleId: "faq", decision: "include", variant: "faq-accordion", order: 8, requiredFactIds: ["f1"] }
  ];
  x.landingInputs.faqDrafts = [{
    id: "faq-qualified", question: "Что известно о проекте?", requiredFactIds: ["f1"],
    publicationStatus: "approved",
    claimQualifications: [{ factId: "f1", text: "Сведения приведены по данным застройщика; характеристики могут измениться." }]
  }];
  const noMarketingClaims = { ...marketing, claimFactIds: {} };
  const profile = buildLandingProfileFromKnowledge(x.knowledge, x.landingInputs, x.refs, noMarketingClaims, {}, {
    now: "2026-11-06T00:00:00Z"
  });
  assert.deepEqual(profile.composition, ["faq"]);
  assert.deepEqual(profile.faqItems[0].answer, [{
    factId: "f1", claim: "Факт", sourceTitle: "Официальный источник",
    qualification: "Сведения приведены по данным застройщика; характеристики могут измениться."
  }]);

  const noQualifier = structuredClone(x);
  noQualifier.landingInputs.faqDrafts[0].claimQualifications = [];
  assert.throws(
    () => buildLandingProfileFromKnowledge(noQualifier.knowledge, noQualifier.landingInputs, noQualifier.refs, noMarketingClaims, {}, {
      now: "2026-11-06T00:00:00Z"
    }),
    /approved-faq-answers|неподтверждённые обязательные факты/
  );

  const leaked = structuredClone(x);
  leaked.landingInputs.strategy.modules.push({
    moduleId: "about", decision: "include", variant: "feature-led", order: 1, requiredFactIds: ["f1"]
  });
  assert.throws(
    () => buildLandingProfileFromKnowledge(leaked.knowledge, leaked.landingInputs, leaked.refs, noMarketingClaims, {}, {
      now: "2026-11-06T00:00:00Z"
    }),
    /неподтверждённые обязательные факты/
  );

  const invalid = structuredClone(x);
  invalid.landingInputs.faqDrafts[0].claimQualifications[0].text = " ";
  assert.throws(
    () => buildLandingProfileFromKnowledge(invalid.knowledge, invalid.landingInputs, invalid.refs, noMarketingClaims, {}, {
      now: "2026-11-06T00:00:00Z"
    }),
    /FAQ qualification must identify/
  );
});

test("FAQ safely formats every supported ClaimValue kind without inventing units or wording",()=>{
  const x=input();
  x.knowledge.claims=[
    {...x.knowledge.claims[0],value:{kind:"text",value:"Центральный район"}},
    {...x.knowledge.claims[0],id:"c2",value:{kind:"number",value:45}},
    {...x.knowledge.claims[0],id:"c3",value:{kind:"boolean",value:true}},
    {...x.knowledge.claims[0],id:"c4",value:{kind:"text_list",value:["Терраса","Панорамное остекление"]}}
  ];
  x.refs.factIdToClaimId={f1:"c1",f2:"c2",f3:"c3",f4:"c4"};
  x.knowledge.sources=[{id:"s1",title:"Официальный источник"}];
  x.knowledge.evidence=[{id:"e1",sourceId:"s1",extract:"Подтверждение"}];
  x.landingInputs.strategy.modules=[{moduleId:"faq",decision:"include",variant:"faq-accordion",order:8,requiredFactIds:["f1","f2","f3","f4"]}];
  x.landingInputs.faqDrafts=[{id:"faq-values",question:"Какие значения подтверждены?",requiredFactIds:["f1","f2","f3","f4"],publicationStatus:"approved"}];
  const profile=buildLandingProfileFromKnowledge(x.knowledge,x.landingInputs,x.refs,marketing,{},{now:"2026-11-06T00:00:00Z"});
  assert.deepEqual(profile.faqItems[0].answer.map(item=>item.claim),[
    "Центральный район","45","Да","Терраса, Панорамное остекление"
  ]);
});

test("FAQ draft questions are never published even when their supporting claim is public",()=>{
  const x=input();
  x.landingInputs.strategy.modules=[{moduleId:"faq",decision:"include",variant:"faq-accordion",order:8,requiredFactIds:["f1"]}];
  x.landingInputs.faqDrafts=[{id:"faq-draft",question:"Черновой вопрос",requiredFactIds:["f1"],publicationStatus:"draft"}];
  assert.throws(()=>buildLandingProfileFromKnowledge(x.knowledge,x.landingInputs,x.refs,marketing,{},{}),/approved-faq-answers/);
});


test("approved selection flow is rendered only when the quiz module is selected",()=>{
  const x=input();
  x.landingInputs.conversionCatalog.push({
    id:"quiz-offer",title:"Персональная подборка",type:"apartment_selection",
    status:"active",consentRequired:true,scenarioId:"personal_selection"
  });
  x.landingInputs.selectionFlow={
    publicEligible:true,title:"Подберём подходящий вариант",resultOfferId:"quiz-offer",
    questions:[{id:"rooms",label:"Сколько комнат нужно?",options:[{id:"one",label:"Одна"},{id:"two",label:"Две"}]}]
  };
  x.landingInputs.strategy.modules.push({
    moduleId:"quiz",decision:"include",variant:"step-form",order:8
  });
  const selected=buildLandingProfileFromKnowledge(x.knowledge,x.landingInputs,x.refs,marketing,{},{});
  assert.ok(selected.selectionQuiz);
  assert.deepEqual(selected.composition,["concept","selection"]);

  const excluded=structuredClone(x);
  excluded.landingInputs.strategy.modules=excluded.landingInputs.strategy.modules.filter(item=>item.moduleId!=="quiz");
  const notSelected=buildLandingProfileFromKnowledge(excluded.knowledge,excluded.landingInputs,excluded.refs,marketing,{},{});
  assert.equal(notSelected.selectionQuiz,null);
  assert.deepEqual(notSelected.composition,["concept"]);
});


test("content-scoped qualification is rendered only beside the exact selected security card",()=>{
  const x=input();
  x.knowledge.claims[0].publicUse="allowed_with_qualification";
  x.knowledge.claims[0].limitations=["Указано в материалах застройщика; сведения могут измениться."];
  x.landingInputs.strategy.modules=[{moduleId:"security",decision:"include",variant:"proof-led",order:1,requiredFactIds:["f1"]}];
  x.landingInputs.marketingCandidates.push({
    id:"a2",title:"Другая карточка",benefit:"Другая польза",strength:"supporting",
    supportingFactIds:["f1"],classification:"marketing_candidate"
  });
  x.landingInputs.contentQualifications=[{
    moduleId:"security",contentId:"a1",factId:"f1",
    text:"Указано в материалах застройщика; сведения могут измениться."
  }];
  const noMarketingClaims={...marketing,claimFactIds:{}};
  const profile=buildLandingProfileFromKnowledge(x.knowledge,x.landingInputs,x.refs,noMarketingClaims,{},{now:"2026-11-06T00:00:00Z"});
  assert.deepEqual(profile.composition,["advantages"]);
  assert.equal(profile.advantages.length,1,"The qualification must not authorize another card using the same fact.");
  assert.equal(profile.advantages[0].id,"a1");
  assert.equal(profile.advantages[0].evidence[0].qualification,
    "Указано в материалах застройщика; сведения могут измениться.");
});

test("content-scoped lifestyle qualification requires the selected story, verified claim and cleared media",()=>{
  const x=input();
  x.knowledge.claims[0].publicUse="allowed_with_qualification";
  x.knowledge.claims[0].limitations=["Сведения указаны в материалах застройщика."];
  x.knowledge.assets=[{id:"courtyard-render",assetKind:"render",url:"https://example.test/courtyard.jpg",
    publicationStatus:"approved",projectMatch:"confirmed",rightsStatus:"confirmed",rightsEvidenceIds:["e1"],
    subjectRefs:[{type:"project",id:"p1"}],allowedContexts:["lifestyle"]}];
  x.landingInputs.strategy.modules=[{moduleId:"lifestyle",decision:"include",variant:"image-led",order:1,requiredFactIds:["f1"]}];
  x.landingInputs.lifestyleStories=[{id:"courtyard-morning",title:"Утро во дворе",
    description:"Сценарий на основе подтверждённой особенности проекта.",sceneLabel:"ДВОР",
    assetId:"courtyard-render",supportingFactIds:["f1"],publicationStatus:"approved"}];
  x.landingInputs.contentQualifications=[{
    moduleId:"lifestyle",contentId:"courtyard-morning",factId:"f1",
    text:"Сведения указаны в материалах застройщика."
  }];
  const noMarketingClaims={...marketing,claimFactIds:{}};
  const profile=buildLandingProfileFromKnowledge(x.knowledge,x.landingInputs,x.refs,noMarketingClaims,{},{now:"2026-11-06T00:00:00Z"});
  assert.deepEqual(profile.composition,["lifestyle"]);
  assert.equal(profile.lifestyleStories[0].evidence[0].qualification,"Сведения указаны в материалах застройщика.");

  const wrongContent=structuredClone(x);
  wrongContent.landingInputs.contentQualifications[0].contentId="another-story";
  assert.throws(()=>buildLandingProfileFromKnowledge(wrongContent.knowledge,wrongContent.landingInputs,wrongContent.refs,noMarketingClaims,{},{now:"2026-11-06T00:00:00Z"}),
    /does not match approved content/);

  const unselected=structuredClone(x);
  unselected.landingInputs.strategy.modules=[];
  assert.throws(()=>buildLandingProfileFromKnowledge(unselected.knowledge,unselected.landingInputs,unselected.refs,noMarketingClaims,{},{now:"2026-11-06T00:00:00Z"}),
    /requires the exact module to be selected/);
});

test("content qualification text must exactly match an approved claim limitation",()=>{
  const x=input();
  x.knowledge.claims[0].publicUse="allowed_with_qualification";
  x.knowledge.claims[0].limitations=["Характеристики могут измениться."];
  x.landingInputs.strategy.modules=[{moduleId:"security",decision:"include",variant:"proof-led",order:1,requiredFactIds:["f1"]}];
  x.landingInputs.contentQualifications=[{
    moduleId:"security",contentId:"a1",factId:"f1",text:"Гарантированное преимущество."
  }];
  const noMarketingClaims={...marketing,claimFactIds:{}};
  assert.throws(()=>buildLandingProfileFromKnowledge(x.knowledge,x.landingInputs,x.refs,noMarketingClaims,{},{now:"2026-11-06T00:00:00Z"}),
    /current, evidenced verified claim requiring qualification/);
});
