import { desc, gte, sql } from 'drizzle-orm';

import { getDb } from '../lib/db.js';

import { providerEvents, type NewProviderEvent } from './schema.js';

/**
 * Record one provider attempt.
 *
 * Telemetry must never fail a request, so callers fire this without awaiting
 * and errors are swallowed here rather than propagating (R2.5).
 *
 * @param event - The attempt to record.
 */
export async function record(event: NewProviderEvent): Promise<void> {
  try {
    await getDb().insert(providerEvents).values(event);
  } catch {
    // A telemetry write is never worth failing a user's analysis over.
  }
}

export interface ProviderHealth {
  provider: string;
  attempts: number;
  successes: number;
  p50LatencyMs: number;
}

/**
 * Per-provider health over a recent window, for the live status strip (R2.6).
 *
 * @param hours - How far back to look.
 * @returns One row per provider seen in the window.
 */
export async function healthSince(hours: number): Promise<ProviderHealth[]> {
  const rows = await getDb()
    .select({
      provider: providerEvents.provider,
      attempts: sql<number>`count(*)::int`,
      successes: sql<number>`count(*) filter (where ${providerEvents.outcome} = 'ok')::int`,
      p50LatencyMs: sql<number>`coalesce(percentile_cont(0.5) within group (order by ${providerEvents.latencyMs}), 0)::int`,
    })
    .from(providerEvents)
    .where(gte(providerEvents.createdAt, sql`now() - make_interval(hours => ${hours})`))
    .groupBy(providerEvents.provider)
    .orderBy(desc(sql`count(*)`));

  return rows;
}
