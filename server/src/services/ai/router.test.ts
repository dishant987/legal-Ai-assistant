import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { AllProvidersFailedError } from '../../lib/errors.js';

import { estimateTokens, LIMITS } from './limits.js';
import { classify, createRouter, ProviderTimeoutError, type RouterOptions } from './router.js';
import type { Attempt, CompleteRequest, Provider, ProviderId, RawRequest } from './types.js';

const schema = z.object({ answer: z.string() });

/** A provider whose behaviour each test dictates outright. */
function mock(
  id: ProviderId,
  behaviour: (call: number, req: RawRequest) => Promise<unknown>,
  supportsFiles = true,
): Provider & { calls: number } {
  const provider = {
    id,
    supportsFiles,
    calls: 0,
    complete(req: RawRequest): Promise<unknown> {
      provider.calls += 1;
      return behaviour(provider.calls, req);
    },
  };
  return provider;
}

const ok = (id: ProviderId, supportsFiles = true) =>
  mock(id, () => Promise.resolve({ answer: id }), supportsFiles);

const boom = (id: ProviderId, error: unknown = new Error('upstream exploded')) =>
  mock(id, () => {
    // Badly behaved SDKs reject with strings and plain objects, and the router
    // has to cope with both — so this test helper must be able to produce them.
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
    return Promise.reject(error);
  });

const garbage = (id: ProviderId) => mock(id, () => Promise.resolve({ wrong: 'shape' }));

function request(overrides: Partial<CompleteRequest<{ answer: string }>> = {}) {
  return {
    stage: 'extract',
    prompt: 'analyse this clause',
    schema,
    temperature: 0,
    estimatedTokens: 100,
    ...overrides,
  };
}

const router = (providers: Provider[], options: Partial<RouterOptions> = {}) =>
  createRouter({ providers, ...options });

describe('failover order', () => {
  it('uses the first provider and leaves the rest untouched', async () => {
    const [a, b] = [ok('gemini'), ok('groq')];
    const result = await router([a, b]).complete(request());

    expect(result).toMatchObject({ provider: 'gemini', degraded: false });
    expect(result.data.answer).toBe('gemini');
    expect(b.calls).toBe(0);
  });

  it('falls through to the second when the first throws', async () => {
    const result = await router([boom('gemini'), ok('groq')]).complete(request());
    expect(result.provider).toBe('groq');
  });

  it('marks the result degraded whenever the preferred provider did not serve it', async () => {
    // The UI tells the user which provider answered; a silent downgrade to a
    // weaker model would be the dishonest option (R2.11).
    const result = await router([boom('gemini'), ok('groq')]).complete(request());
    expect(result.degraded).toBe(true);
  });

  it('walks the whole chain', async () => {
    const result = await router([boom('gemini'), boom('groq'), boom('mistral'), ok('ollama')]).complete(
      request(),
    );
    expect(result.provider).toBe('ollama');
  });

  it('throws AllProvidersFailedError listing every attempt', async () => {
    const error = await router([boom('gemini'), boom('groq')])
      .complete(request())
      .then(
        () => {
          throw new Error('expected the router to fail');
        },
        (e: unknown) => e as AllProvidersFailedError,
      );

    expect(error).toBeInstanceOf(AllProvidersFailedError);
    expect(error.attempts).toHaveLength(2);
    // Retryable on purpose: providers come back, and the router picks whichever
    // recovers first, so "try again in a minute" is honest advice.
    expect(error.retryable).toBe(true);
    expect(error.httpStatus).toBe(503);
  });

  it('survives a provider that rejects with something other than an Error', async () => {
    // Badly behaved SDKs throw strings and plain objects.
    const result = await router([boom('gemini', 'just a string'), ok('groq')]).complete(request());
    expect(result.provider).toBe('groq');
  });

  it('fails cleanly when there are no providers at all', async () => {
    await expect(router([]).complete(request())).rejects.toBeInstanceOf(AllProvidersFailedError);
  });
});

describe('schema validation is the normaliser (R2.2)', () => {
  it('retries the same provider once when the response does not match', async () => {
    const flaky = mock('gemini', (call) =>
      Promise.resolve(call === 1 ? { wrong: 'shape' } : { answer: 'gemini' }),
    );
    const result = await router([flaky]).complete(request());

    expect(flaky.calls).toBe(2);
    expect(result.provider).toBe('gemini');
  });

  it('gives up on that provider after the second malformed response', async () => {
    const bad = garbage('gemini');
    const result = await router([bad, ok('groq')]).complete(request());

    expect(bad.calls).toBe(2);
    expect(result.provider).toBe('groq');
  });

  it('does NOT retry a provider that threw — a 500 will just repeat', async () => {
    const failing = boom('gemini');
    await router([failing, ok('groq')]).complete(request());
    expect(failing.calls).toBe(1);
  });
});

describe('classify', () => {
  it('recognises a timeout', () => {
    expect(classify(new ProviderTimeoutError('gemini'))).toBe('timeout');
  });

  it('recognises a 429 by status field', () => {
    expect(classify({ status: 429 })).toBe('rate_limited');
  });

  it.each([
    'Request failed with status 429',
    'Rate limit reached for model',
    'You exceeded your current quota',
    'Too Many Requests',
  ])('recognises a rate limit from the message %#', (message) => {
    expect(classify(new Error(message))).toBe('rate_limited');
  });

  it('treats anything else as a generic HTTP failure', () => {
    expect(classify(new Error('socket hang up'))).toBe('http_error');
    expect(classify('a string')).toBe('http_error');
    expect(classify(null)).toBe('http_error');
  });
});

describe('timeouts', () => {
  it('abandons a provider that outruns its deadline and moves on', async () => {
    const slow = mock(
      'gemini',
      () =>
        new Promise((resolve) =>
          setTimeout(() => {
            resolve({ answer: 'too late' });
          }, 200),
        ),
    );
    const attempts: Attempt[] = [];

    const result = await router([slow, ok('groq')], {
      timeoutMs: 20,
      onAttempt: (a) => attempts.push(a),
    }).complete(request());

    expect(result.provider).toBe('groq');
    expect(attempts[0]).toMatchObject({ provider: 'gemini', outcome: 'timeout' });
  });
});

describe('token budgets (R2.10)', () => {
  it('skips a provider whose free tier cannot serve the request', async () => {
    // A 20-page contract is ~20,000 tokens. Groq's free tier is 6,000 per
    // minute, so sending it there would 429 every single time.
    const groq = ok('groq');
    const attempts: Attempt[] = [];

    const result = await router([groq, ok('mistral')], {
      onAttempt: (a) => attempts.push(a),
    }).complete(request({ estimatedTokens: 20_000 }));

    expect(groq.calls).toBe(0);
    expect(result.provider).toBe('mistral');
    expect(attempts[0]).toMatchObject({ outcome: 'skipped', reason: 'over token budget' });
  });

  it('lets a small per-clause request through to every provider', async () => {
    const groq = ok('groq');
    await router([groq]).complete(request({ estimatedTokens: 500 }));
    expect(groq.calls).toBe(1);
  });

  it('treats a provider with no published limit as unlimited', async () => {
    const unknown = ok('ollama');
    await router([unknown], { limits: {} }).complete(request({ estimatedTokens: 999_999 }));
    expect(unknown.calls).toBe(1);
  });
});

describe('file support (R2.7)', () => {
  it('skips text-only providers when the stage has a document', async () => {
    const textOnly = ok('groq', false);
    const fileCapable = ok('gemini', true);
    const file = { bytes: new Uint8Array([1, 2, 3]), mimeType: 'application/pdf' };

    const result = await router([textOnly, fileCapable]).complete(request({ file }));

    expect(textOnly.calls).toBe(0);
    expect(result.provider).toBe('gemini');
  });

  it('passes the file through to a provider that can read it', async () => {
    const seen: RawRequest[] = [];
    const reader = mock('gemini', (_c, req) => {
      seen.push(req);
      return Promise.resolve({ answer: 'read' });
    });
    const file = { bytes: new Uint8Array([1]), mimeType: 'image/jpeg' };

    await router([reader]).complete(request({ file }));
    expect(seen[0]?.file).toEqual(file);
  });

  it('omits the file key entirely when there is no document', async () => {
    const seen: RawRequest[] = [];
    const reader = mock('gemini', (_c, req) => {
      seen.push(req);
      return Promise.resolve({ answer: 'read' });
    });

    await router([reader]).complete(request());
    expect(seen[0]).not.toHaveProperty('file');
  });
});

describe('circuit breaker', () => {
  it('opens after three consecutive failures and skips the provider', async () => {
    const failing = boom('gemini');
    const r = router([failing, ok('groq')]);

    for (let i = 0; i < 3; i++) await r.complete(request());
    expect(failing.calls).toBe(3);
    expect(r.snapshot().gemini?.open).toBe(true);

    await r.complete(request());
    expect(failing.calls).toBe(3); // fourth request never reached it
  });

  it('closes again once the cooldown elapses', async () => {
    let clock = 1_000;
    const failing = mock('gemini', (call) =>
      call <= 3 ? Promise.reject(new Error('down')) : Promise.resolve({ answer: 'back' }),
    );
    const r = router([failing, ok('groq')], {
      now: () => clock,
      breakerCooldownMs: 60_000,
    });

    for (let i = 0; i < 3; i++) await r.complete(request());
    expect(r.snapshot().gemini?.open).toBe(true);

    clock += 60_001;
    expect(r.snapshot().gemini?.open).toBe(false);

    const result = await r.complete(request());
    expect(result.provider).toBe('gemini');
  });

  it('resets the failure count on a success, so flakiness never accumulates', async () => {
    const flaky = mock('gemini', (call) =>
      call % 2 === 1 ? Promise.reject(new Error('blip')) : Promise.resolve({ answer: 'fine' }),
    );
    const r = router([flaky, ok('groq')]);

    for (let i = 0; i < 6; i++) await r.complete(request());
    expect(r.snapshot().gemini?.open).toBe(false);
  });

  it('counts two malformed responses as one provider failure, not two', async () => {
    const bad = garbage('gemini');
    const r = router([bad, ok('groq')]);

    await r.complete(request());
    expect(r.snapshot().gemini?.failures).toBe(1);
  });

  it('reports an empty snapshot before anything has been tried', () => {
    expect(router([ok('gemini')]).snapshot()).toEqual({});
  });
});

describe('telemetry', () => {
  it('reports every attempt, including skips, tagged with the stage', async () => {
    const attempts: (Attempt & { stage: string })[] = [];
    await router([boom('gemini'), ok('groq')], {
      onAttempt: (a) => attempts.push(a),
    }).complete(request({ stage: 'simplify' }));

    expect(attempts).toHaveLength(2);
    expect(attempts.every((a) => a.stage === 'simplify')).toBe(true);
    expect(attempts.map((a) => a.outcome)).toEqual(['http_error', 'ok']);
  });

  it('records latency for each attempt', async () => {
    let clock = 0;
    const attempts: Attempt[] = [];
    await router([ok('gemini')], {
      now: () => (clock += 50),
      onAttempt: (a) => attempts.push(a),
    }).complete(request());

    expect(attempts[0]?.latencyMs).toBeGreaterThan(0);
  });

  it('works without a telemetry sink at all', async () => {
    await expect(router([ok('gemini')]).complete(request())).resolves.toBeDefined();
  });
});

describe('estimateTokens', () => {
  it('scales with length', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('a'.repeat(80_000))).toBe(20_000);
  });

  it('puts a typical contract above Groq’s free tier, which is the whole point', () => {
    // ~20 pages of dense text.
    expect(estimateTokens('x'.repeat(80_000))).toBeGreaterThan(LIMITS.groq.tpm);
  });
});

describe('cleanup', () => {
  it('clears the timeout timer on success, so the process can exit', async () => {
    const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
    await router([ok('gemini')]).complete(request());
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});
