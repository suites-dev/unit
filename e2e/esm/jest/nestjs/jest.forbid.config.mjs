import config from './jest.config.js';

export default {
  ...config,
  testMatch: ['**/forbidden-boundaries.guard.test.ts'],
  testEnvironment: '@suites/runners.jest/setup',
};
