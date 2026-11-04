const baseConfig = require('./jest.base.config.cjs');

const config = {
  ...baseConfig(process.env.COVERAGE_DIR),
  projects: [
    '<rootDir>/packages/unit',
    '<rootDir>/packages/core',
    '<rootDir>/packages/di/nestjs',
    '<rootDir>/packages/di/inversify',
    '<rootDir>/packages/di/injection-js',
    '<rootDir>/packages/doubles/jest',
  ],
};

module.exports = config;
