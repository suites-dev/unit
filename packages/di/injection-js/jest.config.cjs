const baseConfig = require('../../../jest.base.config.cjs');

const config = {
  ...baseConfig(process.env.COVERAGE_DIR),
  id: 'di.injectionjs',
  displayName: 'di.injectionjs',
  collectCoverageFrom: ['src/**/*.ts'],
  coveragePathIgnorePatterns: ['index.ts', '__test__/assets/integration.assets.ts'],
};

module.exports = config;
