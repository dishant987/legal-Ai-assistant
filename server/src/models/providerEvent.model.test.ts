import { sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { closeDb, getDb } from '../lib/db.js';

import * as providerEventModel from './providerEvent.model.js';
import { providerEvents } from './schema.js';

const reachable = await (async (): Promise<boolean> => {
  try {
    await getDb().execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
})();

describe.skipIf(!reachable)('provider event model', () => {
  beforeEach(async () => {
    await getDb().delete(providerEvents);
  });

  afterAll(async () => {
    if (reachable) await closeDb();
  });

  it('records an attempt', async () => {
    await providerEventModel.record({
      provider: 'gemini',
      stage: 'extract',
      latencyMs: 1200,
      outcome: 'ok',
    });

    const rows = await getDb().select().from(providerEvents);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.provider).toBe('gemini');
  });

  it('swallows a write failure rather than failing the request (R2.5)', async () => {
    // An invalid enum value would normally reject. Telemetry is never worth
    // failing a user's analysis over, so this must resolve, not throw.
    await expect(
      providerEventModel.record({
        provider: 'gemini',
        stage: 'extract',
        latencyMs: 10,
        outcome: 'not-a-real-outcome' as never,
      }),
    ).resolves.toBeUndefined();

    expect(await getDb().select().from(providerEvents)).toHaveLength(0);
  });

  it('counts attempts and successes per provider', async () => {
    await providerEventModel.record({ provider: 'gemini', stage: 'extract', latencyMs: 100, outcome: 'ok' });
    await providerEventModel.record({
      provider: 'gemini',
      stage: 'extract',
      latencyMs: 300,
      outcome: 'rate_limited',
    });
    await providerEventModel.record({ provider: 'groq', stage: 'simplify', latencyMs: 50, outcome: 'ok' });

    const health = await providerEventModel.healthSince(24);
    const gemini = health.find((h) => h.provider === 'gemini');
    const groq = health.find((h) => h.provider === 'groq');

    expect(gemini).toMatchObject({ attempts: 2, successes: 1 });
    expect(groq).toMatchObject({ attempts: 1, successes: 1 });
  });

  it('reports the median latency, not the mean — one slow call must not skew it', async () => {
    for (const latencyMs of [100, 200, 9000]) {
      await providerEventModel.record({ provider: 'mistral', stage: 'ask', latencyMs, outcome: 'ok' });
    }

    const [health] = await providerEventModel.healthSince(24);
    expect(health?.p50LatencyMs).toBe(200); // mean would be 3100
  });

  it('ignores events outside the window', async () => {
    await providerEventModel.record({ provider: 'ollama', stage: 'extract', latencyMs: 80, outcome: 'ok' });
    await getDb()
      .update(providerEvents)
      .set({ createdAt: sql`now() - interval '48 hours'` });

    expect(await providerEventModel.healthSince(24)).toEqual([]);
  });

  it('returns an empty list when nothing has been recorded', async () => {
    expect(await providerEventModel.healthSince(24)).toEqual([]);
  });
});
