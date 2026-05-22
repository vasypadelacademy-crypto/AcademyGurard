import globals from "globals";
import pluginJs from "@eslint/js";
import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    files: ["**/*.js", "**/*.mjs", "**/*.ts", "**/*.tsx"],
    languageOptions: { globals: globals.browser }
  },
  pluginJs.configs.recommended,
  {
    ignores: ['dist/**/*', 'node_modules/**/*']
  },
  firebaseRulesPlugin.configs['flat/recommended']
];
