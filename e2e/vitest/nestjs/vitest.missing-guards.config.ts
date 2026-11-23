import { defineConfig } from 'vitest/config';
import config from './vitest.config.js';

export default defineConfig({
  ...config,
  test: {
    ...config.test,
    include: ['**/missing-verification.guard.test.ts'],
    setupFiles: [],
  },
});
