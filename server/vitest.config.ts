import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],

    /**
     * The integration tests share one database and truncate tables between
     * cases, so running files in parallel makes them delete each other's rows
     * mid-test. Serial execution is the honest fix; the suite runs in seconds
     * either way.
     */
    fileParallelism: false,
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
        // Provider adapters are a few lines of SDK plumbing each. What they
        // actually decide — JSON recovery and failover — lives in json.ts and
        // router.ts, both pinned at 100%. Mocking four SDKs here would test the
        // mocks, not the adapters.
        'src/services/ai/providers/**',
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

        /**
         * R7.2 — the files where a silent regression would be worst get no
         * slack at all. The router decides which model answers and what happens
         * when one fails; a missed branch here is a failover path nobody has
         * ever executed.
         */
        'src/services/ai/router.ts': { lines: 100, functions: 100, branches: 100, statements: 100 },
        'src/services/ai/json.ts': { lines: 100, functions: 100, branches: 100, statements: 100 },
      },
    },
  },
});
