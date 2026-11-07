import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

function main() {
  const args = process.argv.slice(2);
  const index = args.indexOf("--out");
  if (index < 0 || !args[index + 1]) throw new Error("Usage: node scripts/create-canonical-lead-test-fixture.mjs --out passport.json");
  const passport = JSON.parse(fs.readFileSync(path.resolve("tests/fixtures/galiley.project-passport.draft.json"), "utf8"));

  // Synthetic test-only offer. It is not a real KEY commercial commitment and
  // must never be used by a production build or sent to a live CRM.
  passport.offers = [{
    id: "presentation",
    title: "Тестовый запрос презентации",
    type: "presentation",
    status: "active",
    scenarioId: "presentation_request",
    consentRequired: true,
    requiredFields: ["name", "phone"],
    description: "Тестовый сценарий передачи контекста обращения."
  }];
  passport.contentStrategy = {
    ...(passport.contentStrategy || {}),
    modules: [{
      moduleId: "hero",
      decision: "include",
      reason: "Test-only conversion contract fixture.",
      order: 0,
      variant: "image-led",
      requiredFactIds: [],
      assetIds: [],
      ctaIds: ["hero_presentation"]
    }],
    visualDirection: {
      ...(passport.contentStrategy?.visualDirection || {}),
      theme: "garden-modern",
      heroLayout: "fullscreen"
    }
  };

  const output = path.resolve(args[index + 1]);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(passport, null, 2) + "\n");
  process.stdout.write("Created synthetic, test-only lead conversion passport fixture.\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { main(); } catch (error) { process.stderr.write(error.message + "\n"); process.exitCode = 1; }
}
