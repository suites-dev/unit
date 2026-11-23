const config = require('./jest.config.js');

module.exports = {
  ...config,
  testRegex: '/missing-verification\.guard\.test\.ts$',
  testEnvironment: 'node',
};
