import { defineConfig } from 'vitest/config';
import config from './vitest.config.js';

export default defineConfig({
  ...config,
  test: {
    ...config.test,
    include: ['**/guarded-dependencies.guard.test.ts'],
    setupFiles: ['@suites/runners.vitest'],
  },
});
