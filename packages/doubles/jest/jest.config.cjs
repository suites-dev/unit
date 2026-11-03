const baseConfig = require('../../../jest.base.config.cjs');

const config = {
  ...baseConfig(process.env.COVERAGE_DIR),
  id: 'jest',
  displayName: 'jest',
};

module.exports = config;
