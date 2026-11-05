import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";
import globals from "globals";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Neutrality (spec section 7): ranking components cannot depend on sponsored
    // content; only VerdictView lays out both blocks side by side.
    files: ["components/verdict/**/*.tsx"],
    ignores: ["components/verdict/VerdictView.tsx", "components/verdict/SponsoredBlock.tsx", "**/*.test.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/SponsoredBlock", "./SponsoredBlock"],
              message: "O ranking é neutro: componentes do ranking não podem depender do bloco patrocinado.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["public/sw.js"],
    languageOptions: { globals: globals.serviceworker },
  },
  // Formatting is Prettier's job.
  prettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Third-party bundle copied by scripts/copy-maplibre-worker.mjs.
    "public/vendor/**",
  ]),
]);

export default eslintConfig;
