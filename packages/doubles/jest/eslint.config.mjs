import baseConfig from "../../../eslint.config.mjs";

export default [
  ...baseConfig,
  { languageOptions: { ecmaVersion: 2020 } },
];
