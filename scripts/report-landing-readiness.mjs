#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildLandingReadinessReport } from "../src/landing-readiness-report-v1.mjs";

const args = process.argv.slice(2).filter(Boolean);
const positional = args.filter(item => !item.startsWith("--"));
const requestedMode = args.includes("--production") ? "production" : "demo";
if (!positional[0]) {
  console.error("Usage: node scripts/report-landing-readiness.mjs <built-profile.json> [builder-diagnostics.json] [--production]");
  process.exitCode = 2;
} else {
  try {
    const profile = JSON.parse(await readFile(resolve(positional[0]), "utf8"));
    const diagnostics = positional[1] ? JSON.parse(await readFile(resolve(positional[1]), "utf8")) : {};
    const report = buildLandingReadinessReport({
      profile: profile.profile || profile,
      warnings: diagnostics.warnings || profile.warnings || [],
      requestedMode
    });
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    if (report.blockers.length || (requestedMode === "production" && !report.publicationAllowed)) process.exitCode = 1;
  } catch (error) {
    console.error(`Readiness report failed: ${error.message}`);
    process.exitCode = 1;
  }
}
