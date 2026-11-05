import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const path = process.argv[2] || "artifacts/review-bundle/reference.html";
const html = readFileSync(path, "utf8");
for (const [label, pattern] of [
  ["responsive viewport", /name="viewport"/],
  ["noindex preview", /noindex,nofollow/],
  ["KEY hero", /KEY \/ НЕДВИЖИМОСТЬ/],
  ["semantic main", /<main>/],
  ["dialog interaction", /<dialog id="actionDialog"/],
  ["contextual CTA", /data-context=/],
  ["reduced motion", /prefers-reduced-motion/],
  ["mobile breakpoint", /max-width:780px/],
  ["no lead collection", /сбор и отправка персональных данных отключены/],
  ["no external form action", /<form[^>]+action=/i]
]) {
  if (label === "no external form action") assert.equal(pattern.test(html), false, "Preview must not submit forms.");
  else assert.equal(pattern.test(html), true, "Missing " + label);
}
assert.equal((html.match(/<section class="section/g) || []).length >= 1, true, "Expected composed content sections.");
console.log("PASS: independent editorial reference renderer structure and safety gates.");
