import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const html=readFileSync(new URL("../landing/runtime/index.html",import.meta.url),"utf8");
const app=readFileSync(new URL("../landing/runtime/app.js",import.meta.url),"utf8");
const css=readFileSync(new URL("../landing/runtime/styles.css",import.meta.url),"utf8");

test("lifestyle is a dedicated semantic section, not a gallery alias",()=>{
  assert.match(html,/<section class="lifestyle-section[^"]*" id="lifestyle"/);
  assert.match(html,/<div class="lifestyle-grid" id="lifestyle-grid"><\/div>/);
  assert.match(app,/const sectionIds = \[[^\]]*"lifestyle"/);
  assert.match(app,/data\.lifestyleStories/);
  assert.match(app,/story\.evidence/);
  assert.match(css,/\.lifestyle-section/);
  assert.match(css,/@media\(max-width:720px\)[\s\S]*?\.lifestyle-card\{grid-template-columns:1fr/);
});
