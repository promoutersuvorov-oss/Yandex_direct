import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

function main() {
  const args = process.argv.slice(2);
  const index = args.indexOf("--out");
  if (index < 0 || !args[index + 1]) throw new Error("Usage: node scripts/create-kd905-runtime-fixture.mjs --out passport.json");
  const passport = JSON.parse(fs.readFileSync(path.resolve("examples/kd-905.project-passport.draft.json"), "utf8"));

  // Retain the real KD 905 passport and evidence statuses. Select a small,
  // structurally distinct demo composition and preserve the exact security-card
  // qualification. No project media, plans, distances or walking times are invented.
  passport.contentStrategy = {
    ...(passport.contentStrategy || {}),
    contentQualifications: passport.contentStrategy?.contentQualifications || [],
    modules: [
      {
        moduleId: "hero",
        decision: "include",
        reason: "Project identity only; no unapproved positioning claim is published.",
        order: 0,
        variant: "editorial-split",
        requiredFactIds: [],
        assetIds: [],
        ctaIds: ["presentation"]
      },
      {
        moduleId: "security",
        decision: "include",
        reason: "Render only the parking candidate whose exact supporting fact has a content-scoped qualification.",
        order: 1,
        variant: "proof-led",
        requiredFactIds: ["underground-parking"],
        assetIds: []
      },
      {
        moduleId: "location",
        decision: "include",
        reason: "Project location context without unverified walking distances.",
        order: 2,
        variant: "location-led",
        requiredFactIds: [],
        assetIds: []
      },
      {
        moduleId: "gallery",
        decision: "conditional",
        reason: "No approved, rights-cleared project media is present in this fixture.",
        order: 3,
        variant: "immersive",
        requiredFactIds: [],
        assetIds: [],
        dependencies: ["approved-project-media"]
      }
    ],
    visualDirection: {
      ...(passport.contentStrategy?.visualDirection || {}),
      theme: "warm-editorial",
      heroLayout: "split"
    }
  };

  const output = path.resolve(args[index + 1]);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(passport, null, 2) + "\n");
  process.stdout.write("Created evidence-safe canonical runtime fixture for КД «905».\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { main(); } catch (error) { process.stderr.write(error.message + "\n"); process.exitCode = 1; }
}
