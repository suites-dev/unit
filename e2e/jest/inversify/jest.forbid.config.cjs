const config = require('./jest.config.js');

module.exports = {
  ...config,
  testRegex: '/forbidden-boundaries\\.guard\\.test\\.ts$',
  testEnvironment: '@suites/runners.jest/setup',
};
