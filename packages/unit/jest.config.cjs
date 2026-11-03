const baseConfig = require('../../jest.base.config.cjs');

const config = {
  ...baseConfig(process.env.COVERAGE_DIR),
  id: 'core',
  displayName: 'core',
  collectCoverageFrom: ['src/**/*.ts', '__test__/**/*.ts'],
  coveragePathIgnorePatterns: [
    'index.ts',
    'invalid-adapter.ts',
    'test-adapter.ts',
    'testbed.ts',
    'types.ts',
    'package-resolver.esm.ts',
  ],
};

module.exports = config;
