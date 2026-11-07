import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const outDir = resolve(arg("--out", "artifacts/k15-readiness"));
const audit = spawnSync(process.execPath, ["scripts/audit-k15.mjs"], {
  encoding: "utf8",
  cwd: process.cwd()
});
const output = [audit.stdout, audit.stderr].filter(Boolean).join("\n");
const warnings = [...output.matchAll(/^WARN: (.+)$/gm)].map(match => match[1]);
const blockers = [...output.matchAll(/^FAIL: (.+)$/gm)].map(match => match[1]);
const summaryMatch = output.match(/K15 static audit: (\d+) sections, (\d+) modal definitions, (\d+) wired modal keys, (\d+) quiz questions\./);
const status = audit.status !== 0 || blockers.length
  ? "blocked"
  : warnings.length
    ? "needs_attention"
    : "ready";

const report = {
  schemaVersion: "1.0.0",
  project: {
    id: "k15-legacy-baseline",
    name: "K15 — legacy landing baseline",
    city: null
  },
  generatedAt: new Date().toISOString(),
  scope: "legacy_static_baseline_only",
  status,
  counts: {
    ready: summaryMatch ? 1 : 0,
    warnings: warnings.length,
    blockers: blockers.length
  },
  structuralChecks: summaryMatch ? {
    sections: Number(summaryMatch[1]),
    modalDefinitions: Number(summaryMatch[2]),
    wiredModalKeys: Number(summaryMatch[3]),
    quizQuestions: Number(summaryMatch[4])
  } : null,
  warnings,
  blockers,
  publicationAllowed: false,
  limitations: [
    "This report audits the existing legacy HTML baseline; it is not a canonical project passport.",
    "It does not verify the truth, freshness or legal approval of project claims, prices, offers or media rights.",
    "It does not establish production lead delivery, consent storage, privacy compliance or live analytics.",
    "Browser smoke results are reported separately by the Chromium, Firefox and WebKit workflow jobs.",
    "A passing static audit never authorizes publication."
  ],
  nextActions: [
    "Create a canonical K15 project passport with source-backed facts and claim-level verification.",
    "Resolve the listed legacy configuration warnings before production traffic.",
    "Run separate human visual review and live lead-delivery/privacy integration checks."
  ]
};

mkdirSync(outDir, { recursive: true });
const target = resolve(outDir, "k15-static-readiness-report.json");
writeFileSync(target, JSON.stringify(report, null, 2) + "\n", "utf8");
console.log(`K15 static readiness report written to ${target}`);
console.log(`Status: ${status}; warnings: ${warnings.length}; blockers: ${blockers.length}; publicationAllowed: false`);
if (audit.stdout) process.stdout.write(audit.stdout);
if (audit.stderr) process.stderr.write(audit.stderr);
if (audit.status !== 0) process.exit(audit.status ?? 1);
