import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// eslint-config-next 16 ships native flat configs; FlatCompat is no longer needed.
export default defineConfig([
  globalIgnores([".tmp-*/**", ".next/**", "out/**", "next-env.d.ts"]),
  ...nextVitals,
  ...nextTs,
  {
    // Market is on hold (CLAUDE.md: not touched without a request); its React Compiler findings stay warnings.
    files: ["src/hooks/use-market-quotes.ts", "src/components/tabs/market-tab.tsx", "src/components/market/**"],
    rules: { "react-hooks/set-state-in-effect": "warn", "react-hooks/use-memo": "warn", "react-hooks/purity": "warn", "react-hooks/refs": "warn" },
  },
]);
