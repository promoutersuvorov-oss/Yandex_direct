import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

function main() {
  const args = process.argv.slice(2);
  const index = args.indexOf("--out");
  if (index < 0 || !args[index + 1]) throw new Error("Usage: node scripts/create-canonical-runtime-fixture.mjs --out passport.json");
  const sourcePath = path.resolve("tests/fixtures/galiley.project-passport.draft.json");
  const passport = JSON.parse(fs.readFileSync(sourcePath, "utf8"));

  // Keep the real project's identity and source-backed passport data, but select
  // only the hero slot for this integration slice. Other draft modules remain
  // intentionally out of scope until their publication capabilities are ready.
  passport.contentStrategy = {
    ...(passport.contentStrategy || {}),
    modules: [{
      moduleId: "hero",
      decision: "include",
      reason: "Minimal end-to-end integration fixture; no unsupported content modules.",
      order: 0,
      variant: "image-led",
      requiredFactIds: [],
      assetIds: [],
      ctaIds: ["presentation"]
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
  process.stdout.write("Created minimal canonical runtime fixture for ЖК «Галилей».\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { main(); } catch (error) { process.stderr.write(error.message + "\n"); process.exitCode = 1; }
}
