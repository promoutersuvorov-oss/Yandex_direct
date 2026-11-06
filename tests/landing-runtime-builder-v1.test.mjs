import assert from "node:assert/strict";
import test from "node:test";
import { buildLandingProfileFromKnowledge } from "../src/landing-runtime-builder-v1.mjs";

const copy = Object.fromEntries([
  "heroKicker","headline","lead","conceptTitle","conceptCopy","advantagesTitle","advantagesIntro",
  "visualTitle","visualCopy","apartmentsTitle","apartmentsIntro","locationTitle","locationCopy","closingTitle","closingCopy"
].map(key => [key, key]));
const marketing = { projectId:"p1", approvalStatus:"approved", copy, claimFactIds:{headline:["f1"]} };
function input() {
  const source={id:"s1",title:"Официальный источник"};
  const evidence={id:"e1",sourceId:"s1",extract:"Подтверждение"};
  const claim={id:"c1",subject:{type:"project",id:"p1"},predicate:"project.fact",value:{kind:"text",value:"Факт"},
    epistemicStatus:"verified",publicUse:"allowed_with_qualification",sourceIds:["s1"],evidenceIds:["e1"],limitations:[]};
  return {
    knowledge:{contractVersion:"0.1",project:{id:"p1",name:"Дом",city:"Воронеж",organizationIds:[]},
      sources:[source],evidence:[evidence],claims:[claim],assets:[],plans:[],pointsOfInterest:[],routes:[]},
    landingInputs:{projectId:"p1",strategy:{modules:[{moduleId:"hero",decision:"include",requiredFactIds:["f1"],order:0}]},
      design:{theme:"urban-noir",heroLayout:"split",galleryLayout:"mosaic"},
      marketingCandidates:[{id:"a1",title:"Преимущество",benefit:"Польза",strength:"strong",supportingFactIds:["f1"],classification:"marketing_candidate"}],
      conversionCatalog:[{id:"o1",title:"Презентация",type:"presentation",status:"active",scenarioId:"presentation",consentRequired:true}],
      selectionFlow:null},
    refs:{factIdToClaimId:{f1:"c1"}}
  };
}
test("builds a demo profile from normalized inputs and keeps marketing candidates evidence-gated",()=>{
  const x=input();const profile=buildLandingProfileFromKnowledge(x.knowledge,x.landingInputs,x.refs,marketing,{},{now:"2026-11-06T00:00:00Z"});
  assert.equal(profile.project.id,"p1");assert.equal(profile.mode,"demo");
  assert.deepEqual(profile.composition,["concept","hero"]);
  assert.equal(profile.advantages.length,1);assert.equal(profile.offers.presentation.offerId,"o1");
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
  assert.throws(()=>buildLandingProfileFromKnowledge(y.knowledge,y.landingInputs,y.refs,marketing,{},{}),/no runtime implementation/);
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
