import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['{shared,server}/src/**/*.test.ts', 'tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['shared/src/**/*.ts', 'server/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/index.ts', 'server/src/server.ts'],

      /**
       * R7.1 — thresholds are enforced, not advisory. CI fails below them.
       * Per-file 100% targets for the router, verifier and statute matcher are
       * added in Steps 4-6 as those files land.
       */
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 80,
        statements: 85,
      },
    },
  },
});
