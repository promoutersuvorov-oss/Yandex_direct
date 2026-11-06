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
  assert.match(result.errors[0].message,/approved-project-media/);
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
test("FAQ remains explicitly unsupported and excluded modules do not block generation",()=>{
  const result=resolveRuntimeModulesV1([
    {moduleId:"faq",decision:"include",variant:"faq-accordion"},
    {moduleId:"mortgage",decision:"exclude",variant:"conversion-led"}
  ]);
  assert.equal(result.errors[0].code,"MODULE_UNSUPPORTED");
  assert.equal(LANDING_MODULE_REGISTRY_V1.faq.unsupported,true);
});
