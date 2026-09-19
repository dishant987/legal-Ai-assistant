import { getEnv } from '../config/env.js';
import { getDbTarget } from '../lib/db.js';
import * as healthModel from '../models/health.model.js';
import * as providerEventModel from '../models/providerEvent.model.js';

import { getRouter } from './ai/index.js';

export interface Readiness {
  ready: boolean;
  database: { target: string; reachable: boolean; latencyMs: number | null };
  providers: { configured: string[]; count: number };
}

/**
 * Which providers this process could actually call.
 *
 * A key that is absent — or blank, which a copied `.env` produces — means that
 * provider is simply not in the chain (R2.8). Every provider is a hosted
 * service, so with no keys at all this is legitimately empty.
 *
 * @returns Provider ids in failover order.
 */
export function configuredProviders(): string[] {
  const env = getEnv();
  return [
    ...(env.GEMINI_API_KEY !== undefined ? ['gemini'] : []),
    ...(env.GROQ_API_KEY !== undefined ? ['groq'] : []),
    ...(env.MISTRAL_API_KEY !== undefined ? ['mistral'] : []),
    ...(env.OLLAMA_API_KEY !== undefined ? ['ollama'] : []),
  ];
}

/**
 * Readiness: can this process actually serve a request?
 *
 * The database is the only hard dependency. A process with no provider keys
 * still starts and still reports ready: it can serve health and the client,
 * and an analysis fails cleanly rather than the process refusing to boot.
 *
 * @returns A readiness report; never throws.
 */
export async function readiness(): Promise<Readiness> {
  let latencyMs: number | null;
  try {
    latencyMs = await healthModel.ping();
  } catch {
    latencyMs = null;
  }
  const reachable = latencyMs !== null;

  const configured = configuredProviders();

  return {
    ready: reachable,
    database: { target: getDbTarget(), reachable, latencyMs },
    providers: { configured, count: configured.length },
  };
}

/**
 * Per-provider health over the last day, for the live status strip (R2.6).
 *
 * @returns One entry per provider seen, plus the currently configured list.
 */
export async function providerHealth(): Promise<{
  configured: string[];
  breakers: Record<string, { open: boolean; failures: number }>;
  recent: providerEventModel.ProviderHealth[];
}> {
  return {
    configured: configuredProviders(),
    // Live circuit state, so the status strip can show a provider being skipped
    // rather than only reporting it after the fact.
    breakers: getRouter().snapshot(),
    recent: await providerEventModel.healthSince(24),
  };
}
