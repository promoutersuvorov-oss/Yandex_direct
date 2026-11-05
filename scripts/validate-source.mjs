import { readFileSync, existsSync, statSync } from "node:fs";

const required = [
  "prompts/master-lending.md",
  "docs/architecture/KEY_LANDING_SYSTEM_FOUNDATION_v1.md",
  "docs/architecture/DATA_MODEL_SPEC.md",
  "prompts/PROMPT_1_5_PROJECT_PASSPORT.md",
  "prompts/01_INTELLIGENCE.md",
  "prompts/02_STRATEGIST.md",
  "prompts/03_BUILDER.md",
  "schemas/project-passport.schema.json",
  "examples/project-passport.example.json",
  "landing/reference/K15_landing_edited.html",
];

const errors = [];
for (const path of required) {
  if (!existsSync(path)) errors.push(`Missing required source artifact: ${path}`);
  else if (statSync(path).size === 0) errors.push(`Empty source artifact: ${path}`);
}

for (const path of [
  "schemas/project-passport.schema.json",
  "examples/project-passport.example.json",
]) {
  if (!existsSync(path)) continue;
  try {
    JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    errors.push(`Invalid JSON in ${path}: ${error.message}`);
  }
}

const htmlPath = "landing/reference/K15_landing_edited.html";
if (existsSync(htmlPath)) {
  const html = readFileSync(htmlPath, "utf8");
  const normalized = html.toLowerCase();
  if (!normalized.trimStart().startsWith("<!doctype html>")) {
    errors.push("K15 baseline must begin with a valid HTML doctype.");
  }
  if (!normalized.includes('<html lang="ru"')) {
    errors.push("K15 baseline must declare Russian document language.");
  }
  if (!normalized.includes('name="viewport"')) {
    errors.push("K15 baseline is missing its viewport meta tag.");
  }
  if (!normalized.includes("<body") || !normalized.includes("</html>")) {
    errors.push("K15 baseline has an incomplete HTML document shell.");
  }
}

if (errors.length) {
  console.error(errors.map((error) => `✗ ${error}`).join("\n"));
  process.exit(1);
}

console.log(`✓ Source integrity passed: ${required.length} required artifacts, 2 JSON files, K15 HTML shell.`);
