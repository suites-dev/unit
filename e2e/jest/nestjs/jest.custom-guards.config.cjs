const config = require('./jest.config.js');

module.exports = {
  ...config,
  testRegex: '/custom-environment\.guard\.test\.ts$',
  testEnvironment: './custom-guard-environment.cjs',
};
