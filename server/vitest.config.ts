import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Tests deliberately provoke failures; their log output would otherwise
    // bury the actual results.
    env: { LOG_LEVEL: 'silent' },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/index.ts',
        // Process entry points: exercised end to end, not unit-tested.
        'src/server.ts',
        'src/scripts/**',
        // Pure table declarations, no branches to cover. The constraints and
        // cascades they describe are verified by the model integration tests.
        'src/models/schema.ts',
      ],

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
