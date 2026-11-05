#!/usr/bin/env node
// Single entry point for unit tests: `npm test`.
// Each test imports a CommonJS build of its source from ../.tmp-*-tests,
// so we compile those sources first, then run every tests/*.test.mjs.

import { execFileSync } from "node:child_process";
import { readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const base = ["--module", "commonjs", "--target", "ES2020", "--skipLibCheck"];
const dom = ["--lib", "ES2020,DOM"];

// [sources, outDir, extra flags]
const builds = [
  [["src/hooks/use-mt5.ts", "src/lib/mt5-retirement.ts"], ".tmp-local-bridge-tests", [...dom, "--strict"]],
  [["src/lib/account-chain.ts"], ".tmp-account-chain-tests", [...dom, "--strict"]],
  [["src/lib/home-summary.ts"], ".tmp-home-summary-tests", [...dom, "--strict"]],
  [["src/lib/account-overview.ts"], ".tmp-account-overview-tests", [...dom, "--strict"]],
  [["src/lib/account-payload.ts"], ".tmp-account-payload-tests", [...dom, "--strict"]],
  [["src/lib/account-setup.ts"], ".tmp-account-tests", [...dom, "--strict"]],
  [["src/lib/journal-focus.ts"], ".tmp-journal-focus-tests", [...dom, "--strict"]],
  [["src/lib/journal-layout.ts"], ".tmp-journal-layout-tests", ["--strict"]],
  [["src/lib/journal-filters.ts"], ".tmp-journal-filters-tests", ["--strict"]],
  [["src/lib/timezone.ts"], ".tmp-timezone-tests", [...dom, "--strict"]],
  [["src/lib/prop-rule-settings.ts", "src/lib/prop-rule-record.ts"], ".tmp-prop-rule-tests", [...dom, "--strict"]],
  [["src/lib/session-token.ts"], ".tmp-session-token-tests", [...dom, "--strict"]],
  [["src/lib/session-selection.ts"], ".tmp-session-selection-tests", [...dom, "--strict"]],
  [["src/lib/sessions.ts"], ".tmp-session-tests", dom],
  [["src/lib/supabase/deletion-result.ts"], ".tmp-deletion-tests", [...dom, "--strict"]],
  [["src/lib/trading-calendar.ts"], ".tmp-date-tests", [...dom, "--strict"]],
];

const tsc = join("node_modules", "typescript", "bin", "tsc");

for (const [sources, outDir, flags] of builds) {
  rmSync(outDir, { recursive: true, force: true });
  execFileSync(process.execPath, [tsc, ...sources, "--outDir", outDir, ...base, ...flags], {
    stdio: "inherit",
  });
}

const files = readdirSync("tests")
  .filter((name) => name.endsWith(".test.mjs"))
  .map((name) => join("tests", name));

execFileSync(process.execPath, ["--test", ...files], { stdio: "inherit" });
