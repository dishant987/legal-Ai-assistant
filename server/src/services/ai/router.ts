import { AllProvidersFailedError } from '../../lib/errors.js';

import { LIMITS, type ProviderLimits } from './limits.js';
import type { Attempt, CompleteRequest, Completion, Outcome, Provider, ProviderId } from './types.js';

export const DEFAULT_TIMEOUT_MS = 15_000;
export const DEFAULT_BREAKER_THRESHOLD = 3;
export const DEFAULT_BREAKER_COOLDOWN_MS = 60_000;

/** Thrown internally when a provider outruns its deadline. */
export class ProviderTimeoutError extends Error {
  constructor(readonly provider: ProviderId) {
    super(`${provider} timed out`);
    this.name = 'ProviderTimeoutError';
  }
}

export interface RouterOptions {
  /** Providers in failover order. First is preferred. */
  providers: readonly Provider[];
  /** Partial on purpose: a provider with no published ceiling is unlimited. */
  limits?: Partial<Record<ProviderId, ProviderLimits>>;
  timeoutMs?: number;
  breakerThreshold?: number;
  breakerCooldownMs?: number;
  /** Telemetry sink. Must never throw — the router does not guard callers. */
  onAttempt?: (attempt: Attempt & { stage: string }) => void;
  /** Injectable clock, so breaker timing can be tested without waiting. */
  now?: () => number;
}

interface BreakerState {
  failures: number;
  openUntil: number;
}

/**
 * Classify a provider failure.
 *
 * Rate limiting is separated from generic HTTP failure deliberately: a 429 is
 * a quota problem that resolves on its own, while a 500 may not, and the two
 * mean very different things on the health strip.
 *
 * @param error - Whatever the SDK threw.
 * @returns The outcome to record.
 */
export function classify(error: unknown): Outcome {
  if (error instanceof ProviderTimeoutError) return 'timeout';

  const status = (error as { status?: unknown } | null)?.status;
  if (status === 429) return 'rate_limited';

  const message = error instanceof Error ? error.message : String(error);
  if (/\b429\b|rate.?limit|quota|too many requests/i.test(message)) return 'rate_limited';

  return 'http_error';
}

/**
 * Race a promise against a deadline.
 *
 * The timer is always cleared, including on success: a pending timer would keep
 * the event loop alive and make a short-lived process hang on exit.
 */
async function withTimeout<T>(work: Promise<T>, ms: number, provider: ProviderId): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(new ProviderTimeoutError(provider));
        }, ms);
      }),
    ]);
  } finally {
    // clearTimeout tolerates undefined, so no guard is needed — and a guard
    // here would be a branch no test could ever reach.
    clearTimeout(timer);
  }
}

export interface Router {
  complete<T>(req: CompleteRequest<T>): Promise<Completion<T>>;
  /** Breaker state, for the health endpoint and for tests. */
  snapshot(): Record<string, { open: boolean; failures: number }>;
}

/**
 * Build a failover router over an ordered list of providers.
 *
 * A factory rather than a module singleton so tests can supply mock providers,
 * a fake clock and their own limits — no network, no keys, no module mocking.
 *
 * @param options - Providers and tuning.
 * @returns A router.
 */
export function createRouter(options: RouterOptions): Router {
  const {
    providers,
    limits = LIMITS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    breakerThreshold = DEFAULT_BREAKER_THRESHOLD,
    breakerCooldownMs = DEFAULT_BREAKER_COOLDOWN_MS,
    onAttempt,
    now = Date.now,
  } = options;

  const breakers = new Map<ProviderId, BreakerState>();

  const breakerFor = (id: ProviderId): BreakerState => {
    let state = breakers.get(id);
    if (state === undefined) {
      state = { failures: 0, openUntil: 0 };
      breakers.set(id, state);
    }
    return state;
  };

  const isOpen = (id: ProviderId): boolean => breakerFor(id).openUntil > now();

  const recordSuccess = (id: ProviderId): void => {
    const state = breakerFor(id);
    state.failures = 0;
    state.openUntil = 0;
  };

  const recordFailure = (id: ProviderId): void => {
    const state = breakerFor(id);
    state.failures += 1;
    if (state.failures >= breakerThreshold) {
      state.openUntil = now() + breakerCooldownMs;
      state.failures = 0;
    }
  };

  async function complete<T>(req: CompleteRequest<T>): Promise<Completion<T>> {
    const attempts: Attempt[] = [];

    const note = (attempt: Attempt): void => {
      attempts.push(attempt);
      onAttempt?.({ ...attempt, stage: req.stage });
    };

    for (const [index, provider] of providers.entries()) {
      const id = provider.id;

      // A provider that cannot read a document is no use to a stage that has one.
      if (req.file !== undefined && !provider.supportsFiles) {
        note({ provider: id, outcome: 'skipped', latencyMs: 0, reason: 'no file support' });
        continue;
      }

      // R2.10 — do not spend a request to rediscover a published quota.
      if (req.estimatedTokens > (limits[id]?.tpm ?? Number.POSITIVE_INFINITY)) {
        note({ provider: id, outcome: 'skipped', latencyMs: 0, reason: 'over token budget' });
        continue;
      }

      if (isOpen(id)) {
        note({ provider: id, outcome: 'skipped', latencyMs: 0, reason: 'circuit open' });
        continue;
      }

      // Two passes, but only a malformed response earns the second: a timeout or
      // a 500 will almost certainly repeat, while bad JSON often will not.
      // Every path out of this loop except `return` is a failure, so reaching
      // the line below at all means this provider did not serve the request.
      for (let attempt = 0; attempt < 2; attempt++) {
        const started = now();
        let raw: unknown;

        try {
          raw = await withTimeout(
            provider.complete({
              prompt: req.prompt,
              temperature: req.temperature,
              ...(req.file !== undefined ? { file: req.file } : {}),
            }),
            timeoutMs,
            id,
          );
        } catch (error) {
          const outcome = classify(error);
          note({
            provider: id,
            outcome,
            latencyMs: now() - started,
            reason: error instanceof Error ? error.name : 'unknown',
          });
          break; // not a parse problem — retrying the same provider would not help
        }

        const parsed = req.schema.safeParse(raw);
        if (parsed.success) {
          note({ provider: id, outcome: 'ok', latencyMs: now() - started });
          recordSuccess(id);
          return { data: parsed.data, provider: id, degraded: index > 0 };
        }

        note({
          provider: id,
          outcome: 'parse_error',
          latencyMs: now() - started,
          reason: 'schema mismatch',
        });
      }

      recordFailure(id);
    }

    throw new AllProvidersFailedError(attempts);
  }

  return {
    complete,
    snapshot: () =>
      Object.fromEntries(
        [...breakers].map(([id, state]) => [id, { open: state.openUntil > now(), failures: state.failures }]),
      ),
  };
}
