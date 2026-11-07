import assert from "node:assert/strict";
import test from "node:test";
import { resolveRuntimeModulesV1, LANDING_MODULE_REGISTRY_V1 } from "../src/landing-module-registry-v1.mjs";

const facts=["f1","f2","f3"];
test("registry resolves supported module IDs to explicit runtime sections and fixed slots",()=>{
  const result=resolveRuntimeModulesV1([
    {moduleId:"hero",decision:"include",variant:"editorial-split",order:0},
    {moduleId:"key",decision:"include",variant:"feature-led",order:1,requiredFactIds:["f1"]},
    {moduleId:"about",decision:"include",variant:"feature-led",order:2,requiredFactIds:["f2"]},
    {moduleId:"security",decision:"include",variant:"proof-led",order:5,requiredFactIds:["f3"]},
    {moduleId:"location",decision:"include",variant:"location-led",order:6}
  ],{publishableFactIds:facts});
  assert.deepEqual(result.errors,[]);
  assert.deepEqual(result.composition,["concept","advantages","location"]);
  assert.equal(result.placements.filter(x=>x.slot==="hero").length,2);
});
test("conditional modules are skipped with diagnostics when runtime dependencies are absent",()=>{
  const result=resolveRuntimeModulesV1([
    {moduleId:"gallery",decision:"conditional",variant:"immersive",order:3},
    {moduleId:"floor-plans",decision:"conditional",variant:"plan-selector",order:7}
  ]);
  assert.deepEqual(result.errors,[]);
  assert.deepEqual(result.composition,[]);
  assert.equal(result.warnings.length,2);
});
test("included modules with missing runtime dependencies fail closed",()=>{
  const result=resolveRuntimeModulesV1([
    {moduleId:"lifestyle",decision:"include",variant:"image-led",order:4}
  ]);
  assert.equal(result.errors[0].code,"INCLUDED_MODULE_NOT_READY");
  assert.match(result.errors[0].message,/approved-lifestyle-stories/);
});
test("unknown modules and unsupported variants are errors, never silently omitted",()=>{
  const result=resolveRuntimeModulesV1([
    {moduleId:"hero-2",decision:"include",variant:"editorial-split"},
    {moduleId:"about",decision:"include",variant:"cinematic"}
  ]);
  assert.deepEqual(result.errors.map(x=>x.code),["MODULE_UNKNOWN","MODULE_VARIANT_UNSUPPORTED"]);
});
test("non-mergeable section collisions are rejected",()=>{
  const result=resolveRuntimeModulesV1([
    {moduleId:"about",decision:"include",variant:"feature-led"},
    {moduleId:"location",decision:"include",variant:"location-led"}
  ]);
  assert.deepEqual(result.errors,[]);
  assert.deepEqual(result.composition,["concept","location"]);
  const collision=resolveRuntimeModulesV1([
    {moduleId:"about",decision:"include",variant:"feature-led"},
    {moduleId:"about",decision:"include",variant:"feature-led"}
  ]);
  assert.equal(collision.errors[0].code,"MODULE_SECTION_COLLISION");
});
test("FAQ resolves to an evidence-gated accordion section",()=>{
  const result=resolveRuntimeModulesV1([{moduleId:"faq",decision:"include",variant:"faq-accordion",order:8,requiredFactIds:["f1"]}],
    {publishableFactIds:["f1"],capabilities:["approved-faq-answers"]});
  assert.deepEqual(result.errors,[]);
  assert.deepEqual(result.composition,["faq"]);
  assert.equal(result.placements[0].runtimeVariant,"evidence-accordion");
  const blocked=resolveRuntimeModulesV1([{moduleId:"faq",decision:"include",variant:"faq-accordion",order:8}]);
  assert.equal(blocked.errors[0].code,"INCLUDED_MODULE_NOT_READY");
  assert.match(blocked.errors[0].message,/approved-faq-answers/);
});

test("lifestyle resolves to its own runtime section and requires approved story capability",()=>{
  const result=resolveRuntimeModulesV1([
    {moduleId:"lifestyle",decision:"include",variant:"image-led",order:4,requiredFactIds:["f1"]}
  ],{publishableFactIds:["f1"],capabilities:["approved-lifestyle-stories"]});
  assert.deepEqual(result.errors,[]);
  assert.deepEqual(result.composition,["lifestyle"]);
  assert.equal(result.placements[0].sectionId,"lifestyle");
});


test("canonical apartments and quiz IDs resolve to real runtime sections",()=>{
  const result=resolveRuntimeModulesV1([
    {moduleId:"apartments",decision:"include",variant:"plan-selector",order:4},
    {moduleId:"quiz",decision:"include",variant:"step-form",order:8}
  ],{capabilities:["current-inventory","rights-cleared-plan-assets","approved-selection-flow"]});
  assert.deepEqual(result.errors,[]);
  assert.deepEqual(result.composition,["apartments","selection"]);
  assert.equal(result.placements.find(item=>item.moduleId==="apartments").sectionId,"apartments");
  assert.equal(result.placements.find(item=>item.moduleId==="quiz").sectionId,"selection");
});

test("quiz fails closed until an approved selection flow capability is available",()=>{
  const result=resolveRuntimeModulesV1([
    {moduleId:"quiz",decision:"include",variant:"step-form",order:8}
  ]);
  assert.equal(result.errors[0].code,"INCLUDED_MODULE_NOT_READY");
  assert.deepEqual(result.errors[0].missingCapabilities,["approved-selection-flow"]);
});

test("legacy floor-plans alias and canonical apartments cannot both claim the same section",()=>{
  const result=resolveRuntimeModulesV1([
    {moduleId:"floor-plans",decision:"include",variant:"plan-selector",order:4},
    {moduleId:"apartments",decision:"include",variant:"plan-selector",order:5}
  ],{capabilities:["current-inventory","rights-cleared-plan-assets"]});
  assert.equal(result.errors[0].code,"MODULE_SECTION_COLLISION");
});


test("Galiley semantic variants resolve to existing hero, lifestyle, concept and FAQ runtime sections",()=>{
  const result=resolveRuntimeModulesV1([
    {moduleId:"hero",decision:"include",variant:"image-led",order:0},
    {moduleId:"lifestyle",decision:"include",variant:"feature-led",order:1,requiredFactIds:["f1"]},
    {moduleId:"about",decision:"include",variant:"architectural",order:2,requiredFactIds:["f2"]},
    {moduleId:"faq",decision:"include",variant:"proof-led",order:3,requiredFactIds:["f3"]}
  ],{
    publishableFactIds:facts,
    capabilities:["approved-lifestyle-stories","approved-faq-answers"]
  });
  assert.deepEqual(result.errors,[]);
  assert.deepEqual(result.composition,["lifestyle","concept","faq"]);
  assert.equal(result.placements.find(item=>item.moduleId==="hero").runtimeVariant,"fullscreen");
  assert.equal(result.placements.find(item=>item.moduleId==="lifestyle").runtimeVariant,"image-led");
  assert.equal(result.placements.find(item=>item.moduleId==="about").runtimeVariant,"feature-led");
  assert.equal(result.placements.find(item=>item.moduleId==="faq").runtimeVariant,"evidence-accordion");
});


const PRODUCT_CATALOG_IDS = [
  "hero","key","gallery","about","territory","security","location","lifestyle",
  "quiz","gift","apartments","price","mortgage","developer","progress","steps",
  "faq","contacts","faq-legal","footer-nav","modal","lightbox","promo","map"
];

test("every product catalog module has an explicit, honest runtime capability status",()=>{
  const validStatuses=new Set(["implemented","partial","placeholder","unsupported"]);
  for (const id of PRODUCT_CATALOG_IDS) {
    const definition=LANDING_MODULE_REGISTRY_V1[id];
    assert.ok(definition, `catalog module ${id} must be declared in the registry`);
    assert.ok(validStatuses.has(definition.status), `catalog module ${id} must have an explicit status`);
    if (definition.status==="unsupported" || definition.status==="placeholder") {
      assert.ok(definition.reason, `${id} must explain why it is unavailable`);
    } else {
      assert.ok(definition.runtimeComponent, `${id} must identify its actual runtime component`);
      assert.ok(definition.variants && Object.keys(definition.variants).length>0, `${id} must declare supported variants`);
    }
  }
});

test("unsupported catalog modules fail closed with a specific diagnostic",()=>{
  const unsupported=PRODUCT_CATALOG_IDS.filter(id=>LANDING_MODULE_REGISTRY_V1[id].status==="unsupported");
  assert.ok(unsupported.length>0);
  for (const moduleId of unsupported) {
    const result=resolveRuntimeModulesV1([{moduleId,decision:"include",variant:"not-applicable"}]);
    assert.equal(result.errors.length,1,`${moduleId} must produce exactly one blocking diagnostic`);
    assert.equal(result.errors[0].code,"MODULE_UNSUPPORTED");
    assert.equal(result.errors[0].moduleId,moduleId);
    assert.ok(result.errors[0].message);
  }
});

test("resolved placements expose implementation status and component identity",()=>{
  const result=resolveRuntimeModulesV1([
    {moduleId:"hero",decision:"include",variant:"editorial-split",order:0},
    {moduleId:"apartments",decision:"include",variant:"plan-selector",order:10}
  ],{capabilities:["current-inventory","rights-cleared-plan-assets"]});
  assert.deepEqual(result.errors,[]);
  assert.equal(result.placements.find(x=>x.moduleId==="hero").status,"implemented");
  assert.equal(result.placements.find(x=>x.moduleId==="hero").runtimeComponent,"HeroSection");
  assert.equal(result.placements.find(x=>x.moduleId==="apartments").status,"implemented");
  assert.equal(result.placements.find(x=>x.moduleId==="apartments").runtimeComponent,"ApartmentsSection");
});


test("partial modules remain explicit in diagnostics instead of appearing fully implemented",()=>{
  const result=resolveRuntimeModulesV1([
    {moduleId:"security",decision:"include",variant:"proof-led",order:5,requiredFactIds:["f1"]}
  ],{publishableFactIds:["f1"]});
  assert.deepEqual(result.errors,[]);
  assert.equal(result.placements[0].status,"partial");
  assert.equal(result.placements[0].runtimeComponent,"AdvantagesSection");
  assert.equal(result.warnings.length,1);
  assert.equal(result.warnings[0].code,"MODULE_PARTIAL_IMPLEMENTATION");
  assert.equal(result.warnings[0].moduleId,"security");
  assert.match(result.warnings[0].message,/отдельного специализированного security-компонента/);
});
