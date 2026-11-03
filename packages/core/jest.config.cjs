const baseConfig = require('../../jest.base.config.cjs');

const config = {
  ...baseConfig(process.env.COVERAGE_DIR),
  id: 'core',
  displayName: 'core',
  collectCoverageFrom: ['src/**/*.ts', '__test__/**/*.ts'],
  coveragePathIgnorePatterns: [
    'injectable-registry.fixture.ts',
    '__test__/sociable/assets',
    'index.ts',
    'integration.assets.ts',
    'invalid-adapter.ts',
    'test-adapter.ts',
    'main.ts',
    'types.ts',
  ],
};

module.exports = config;
