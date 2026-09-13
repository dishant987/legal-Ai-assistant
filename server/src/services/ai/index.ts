import * as providerEventModel from '../../models/providerEvent.model.js';

import { buildProviders } from './registry.js';
import { createRouter, type Router } from './router.js';

let router: Router | undefined;

/**
 * The application's AI router, built on first use.
 *
 * Lazy for the same reason the database client is: importing this module must
 * not demand an environment, or nothing downstream can be unit-tested.
 *
 * @returns The shared router.
 */
export function getRouter(): Router {
  router ??= createRouter({
    providers: buildProviders(),
    onAttempt: (attempt) => {
      // Fire and forget. A telemetry write must never delay or fail an
      // analysis, and the model swallows its own errors for the same reason.
      void providerEventModel.record({
        provider: attempt.provider,
        stage: attempt.stage,
        latencyMs: attempt.latencyMs,
        outcome: attempt.outcome,
        ...(attempt.reason !== undefined ? { errorCode: attempt.reason } : {}),
      });
    },
  });
  return router;
}

/** Drop the memoised router. Tests only. */
export function resetRouter(): void {
  router = undefined;
}

export { createRouter, classify, ProviderTimeoutError } from './router.js';
export { estimateTokens, LIMITS } from './limits.js';
export { buildProviders } from './registry.js';
export type { Provider, ProviderId, CompleteRequest, Completion, Attempt } from './types.js';
