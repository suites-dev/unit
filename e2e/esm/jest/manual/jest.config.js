export default {
  testEnvironment: 'node',
  testMatch: ['**/*.e2e.test.ts'],
  extensionsToTreatAsEsm: ['.ts'],
  transform: { '^.+\\.ts$': ['ts-jest', { useESM: true }] },
};
