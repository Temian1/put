import js from "@eslint/js";
import globals from "globals";
import hooks from "eslint-plugin-react-hooks";

export default [
  {
    ignores: [
      "dist/**",
      "dist-e2e/**",
      "node_modules/**",
      ".verification/**",
      "test-results/**",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { "react-hooks": hooks },
    rules: {
      ...hooks.configs.recommended.rules,
      "no-unused-vars": [
        "error",
        {
          varsIgnorePattern: "^([A-Z]|_)",
          argsIgnorePattern: "^([A-Z]|_)",
          caughtErrorsIgnorePattern: "^e$",
        },
      ],
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
];
