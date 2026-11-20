import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// eslint-config-next 16 ships native flat configs; FlatCompat is no longer needed.
export default defineConfig([
  globalIgnores([".tmp-*/**", ".next/**", "out/**", "next-env.d.ts"]),
  ...nextVitals,
  ...nextTs,
  {
    // React Compiler rules that arrived with eslint-plugin-react-hooks 7. Existing code predates them
    // (mostly reading browser storage in an effect after mount); they warn until that code is reworked —
    // see the roadmap. New code should not add warnings here.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/use-memo": "warn",
    },
  },
]);
