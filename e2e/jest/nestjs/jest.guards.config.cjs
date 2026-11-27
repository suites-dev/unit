const config = require('./jest.config.js');

module.exports = {
  ...config,
  testRegex: '/guarded-dependencies\\.guard\\.test\\.ts$',
  testEnvironment: '@suites/runners.jest',
};
