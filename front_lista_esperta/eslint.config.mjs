import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";
import globals from "globals";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Neutralidade do ranking (docs/03-monetizacao-b2b.md, Seção 3.6).
    files: ["lib/verdict/**/*.ts"],
    // Os testes importam anúncios de propósito, para provar que eles não alteram o veredito.
    ignores: ["**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/ads/**", "**/ads", "**/cashback/**"],
              message: "O motor de veredito é neutro: não pode depender de anúncios.",
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
  ]),
]);

export default eslintConfig;
