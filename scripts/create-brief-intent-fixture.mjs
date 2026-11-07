import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

function main() {
  const args = process.argv.slice(2);
  const passportArg = args.indexOf("--passport");
  const outputArg = args.indexOf("--out");
  if (passportArg < 0 || !args[passportArg + 1] || outputArg < 0 || !args[outputArg + 1]) {
    throw new Error("Usage: node scripts/create-brief-intent-fixture.mjs --passport passport.json --out brief.json");
  }
  const passport = JSON.parse(fs.readFileSync(path.resolve(args[passportArg + 1]), "utf8"));
  const template = JSON.parse(fs.readFileSync(path.resolve("examples/landing-brief.example.json"), "utf8"));
  const operationalOffer = (passport.offers || []).find(item =>
    item?.type === "presentation" && item.status === "active" && item.consentRequired !== false
  );
  if (!operationalOffer) throw new Error("Test passport must contain a real active presentation offer");

  const fact = (passport.facts || []).find(item =>
    item?.status === "verified" && item.publicUse === "allowed" && item.sources?.length
  );
  if (!fact) throw new Error("Test passport must contain a verified, public-use fact");

  const brief = structuredClone(template);
  const segmentId = brief.strategy.primarySegmentId;
  const hookId = brief.strategy.primaryHookId;
  const offerId = "test_project_presentation";
  const funnelId = "test_presentation_funnel";
  const hook = brief.hooks[0];

  brief.projectId = passport.project.id;
  brief.sourcePassportVersion = passport.schemaVersion;
  brief.approvalStatus = "approved";
  brief.strategy.coreIdea = "TEST FIXTURE ONLY — no real audience insight or positioning claim.";
  brief.strategy.positioning = {
    ...brief.strategy.positioning,
    statement: "TEST FIXTURE ONLY — positioning text is not approved for publication.",
    supportingFactIds: [fact.id],
    status: "approved",
    audienceSegmentId: segmentId,
    primaryNeed: "TEST FIXTURE ONLY — mock need used only to exercise the builder contract.",
    productFocus: "TEST FIXTURE ONLY — no apartment availability or commercial terms are asserted.",
    primaryTrafficSource: "TEST FIXTURE ONLY — no campaign research is represented.",
    primaryConverter: "TEST FIXTURE ONLY — no real KEY delivery workflow is represented.",
    gateStatus: "approved",
    confidence: "medium",
    rationale: "Synthetic sign-off used only to test reference wiring; it is not a real positioning approval.",
    evidenceBasis: {
      audience: { type: "research_finding", finding: "TEST FIXTURE ONLY — synthetic evidence, not customer research." },
      need: { type: "research_finding", finding: "TEST FIXTURE ONLY — synthetic evidence, not customer research." },
      product: { type: "fact", finding: "TEST FIXTURE ONLY — the test passport is used to validate a source reference." },
      traffic: { type: "research_finding", finding: "TEST FIXTURE ONLY — no search-demand analysis is represented." },
      converter: { type: "fact", finding: "TEST FIXTURE ONLY — no live CRM or delivery process is represented." }
    },
    validationPlan: ["TEST FIXTURE ONLY — replace with genuine research and operational approval before any production use."],
    blockingIssues: []
  };

  hook.status = "approved";
  hook.message = "TEST FIXTURE ONLY — узнать, подходит ли проект под ваши планы";
  hook.supportingFactIds = [];
  hook.hypothesis = "TEST FIXTURE ONLY — no real conversion hypothesis is asserted.";

  brief.offers = [{
    id: offerId,
    type: "presentation",
    title: "TEST FIXTURE ONLY — запросить презентацию",
    value: "TEST FIXTURE ONLY — проверить передачу намерения",
    deliverable: "TEST FIXTURE ONLY — no real delivery promise",
    readiness: "ready",
    deliveryMethod: "TEST FIXTURE ONLY",
    deliverySla: "TEST FIXTURE ONLY — no SLA",
    scenarioId: operationalOffer.scenarioId || operationalOffer.id,
    segmentIds: [segmentId],
    requiredFields: ["name", "phone"],
    qualificationQuestionIds: [],
    passportOfferId: operationalOffer.id
  }];

  brief.funnels = [{
    id: funnelId,
    segmentIds: [segmentId],
    hookIds: [hookId],
    offerId,
    stages: [
      { id: "test_landing_visit", name: "TEST FIXTURE ONLY — visit", userAction: "Open the test page" },
      { id: "test_presentation_intent", name: "TEST FIXTURE ONLY — intent", userAction: "Click a CTA" }
    ],
    successEvent: "test_only_presentation_intent"
  }];

  const cta = (id, moduleId, label) => ({
    id, label, moduleId, intent: "get_information", offerId, funnelId, hookId,
    segmentIds: [segmentId], scenarioId: operationalOffer.scenarioId || operationalOffer.id,
    placement: moduleId === "hero" ? "hero_primary" : "closing_primary",
    qualificationQuestionIds: []
  });
  brief.ctas = [
    cta("test_hero_presentation", "hero", "TEST: получить презентацию"),
    cta("test_closing_presentation", "closing", "TEST: обсудить проект")
  ];
  brief.strategy.primaryCtaId = "test_hero_presentation";
  brief.notes = [...(brief.notes || []), "TEST FIXTURE ONLY: all approvals and evidence above are synthetic. Never publish or use this brief for production."];
  const output = path.resolve(args[outputArg + 1]);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(brief, null, 2) + "\n");
  process.stdout.write("Created test-only approved LANDING BRIEF fixture; it contains no real positioning or audience research.\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { main(); } catch (error) { process.stderr.write(error.message + "\n"); process.exitCode = 1; }
}
