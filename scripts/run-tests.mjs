#!/usr/bin/env node
// Single entry point for unit tests: `npm test`.
// Each test imports a CommonJS build of its source from ../.tmp-*-tests/<path under src>.js
// (compiled with --rootDir src, so the layout mirrors src/),
// so we compile those sources first, then run every tests/*.test.mjs.

import { execFileSync } from "node:child_process";
import { readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const base = ["--module", "commonjs", "--target", "ES2020", "--skipLibCheck", "--rootDir", "src"];
const dom = ["--lib", "ES2020,DOM"];

// [sources, outDir, extra flags]
const builds = [
  [["src/hooks/use-mt5.ts", "src/lib/market/mt5-retirement.ts"], ".tmp-local-bridge-tests", [...dom, "--strict"]],
  [["src/lib/accounts/account-chain.ts"], ".tmp-account-chain-tests", [...dom, "--strict"]],
  [["src/lib/dashboard/dashboard-layout.ts"], ".tmp-dashboard-layout-tests", ["--strict"]],
  [["src/lib/dashboard/weekly-report.ts"], ".tmp-weekly-report-tests", dom],
  [["src/lib/dashboard/session-status.ts"], ".tmp-session-status-tests", dom],
  [["src/lib/dashboard/day-dial.ts"], ".tmp-day-dial-tests", [...dom, "--strict"]],
  [["src/lib/dashboard/home-summary.ts", "src/lib/journal/trade-review.ts"], ".tmp-home-summary-tests", [...dom, "--strict"]],
  [["src/lib/accounts/account-overview.ts"], ".tmp-account-overview-tests", [...dom, "--strict"]],
  [["src/lib/accounts/account-payload.ts"], ".tmp-account-payload-tests", [...dom, "--strict"]],
  [["src/lib/accounts/account-setup.ts"], ".tmp-account-tests", [...dom, "--strict"]],
  [["src/lib/journal/journal-focus.ts"], ".tmp-journal-focus-tests", [...dom, "--strict"]],
  [["src/lib/journal/journal-layout.ts"], ".tmp-journal-layout-tests", ["--strict"]],
  [["src/lib/journal/journal-filters.ts"], ".tmp-journal-filters-tests", ["--strict"]],
  [["src/lib/strategy-control/violation-cost.ts"], ".tmp-violation-cost-tests", ["--strict"]],
  [["src/lib/journal/csv-import.ts"], ".tmp-csv-import-tests", [...dom, "--strict"]],
  [["src/lib/journal/screenshot-gallery.ts"], ".tmp-screenshot-gallery-tests", dom],
  [["src/lib/journal/performance-breakdown.ts"], ".tmp-performance-breakdown-tests", dom],
  [["src/lib/journal/trade-review.ts", "src/lib/journal/trade-financials.ts"], ".tmp-trade-review-tests", [...dom, "--strict"]],
  [["src/lib/time/timezone.ts"], ".tmp-timezone-tests", [...dom, "--strict"]],
  [["src/lib/accounts/prop-rule-settings.ts", "src/lib/accounts/prop-rule-record.ts"], ".tmp-prop-rule-tests", [...dom, "--strict"]],
  [["src/lib/auth/request-guard.ts"], ".tmp-request-guard-tests", [...dom, "--strict"]],
  [["src/lib/auth/provision.ts"], ".tmp-user-provision-tests", ["--strict"]],
  [["src/lib/auth/recovery-ticket.ts"], ".tmp-recovery-ticket-tests", [...dom, "--strict"]],
  [["src/lib/time/session-selection.ts"], ".tmp-session-selection-tests", [...dom, "--strict"]],
  [["src/lib/time/sessions.ts"], ".tmp-session-tests", dom],
  [["src/lib/supabase/deletion-result.ts"], ".tmp-deletion-tests", [...dom, "--strict"]],
  [["src/lib/time/trading-calendar.ts"], ".tmp-date-tests", [...dom, "--strict"]],
  [["src/lib/dashboard/goals.ts", "src/lib/time/timezone.ts", "src/lib/journal/trade-review.ts"], ".tmp-goals-tests", [...dom, "--strict"]],
  [["src/lib/journal/number-format.ts"], ".tmp-number-format-tests", ["--strict"]],
  [["src/lib/preferences/user-preferences.ts"], ".tmp-user-preferences-tests", ["--strict"]],
  [["src/lib/journal/trades-csv.ts"], ".tmp-trades-csv-tests", ["--strict"]],
  [["src/lib/journal/trader-summary.ts", "src/lib/time/timezone.ts"], ".tmp-trader-summary-tests", [...dom, "--strict"]],
  [["src/lib/auth/password-strength.ts", "src/lib/auth/request-guard.ts", "src/lib/bridge/signature.ts"], ".tmp-password-strength-tests", [...dom, "--strict"]],
  [["src/lib/i18n/core.ts", "src/lib/i18n/uk.ts"], ".tmp-i18n-tests", ["--strict"]],
  [["src/lib/news/economic-calendar.ts"], ".tmp-economic-calendar-tests", ["--strict"]],
  [["src/lib/news/news-trades.ts"], ".tmp-news-trades-tests", ["--strict"]],
  [["src/lib/bridge/signature.ts", "src/lib/bridge/pairing.ts", "src/lib/bridge/broker-clock.ts", "src/lib/bridge/deals-to-trades.ts", "src/lib/bridge/trade-sync.ts", "src/lib/bridge/account-match.ts", "src/lib/bridge/device-payload.ts"], ".tmp-bridge-tests", [...dom, "--strict"]],
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
