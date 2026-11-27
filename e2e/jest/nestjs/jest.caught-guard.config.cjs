const config = require('./jest.config.js');

module.exports = {
  ...config,
  testRegex: '/caught-dependency\.guard\.test\.ts$',
  testEnvironment: '@suites/runners.jest/setup',
};
