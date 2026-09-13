import { getEnv } from '../config/env.js';
import { getDbTarget } from '../lib/db.js';
import * as healthModel from '../models/health.model.js';
import * as providerEventModel from '../models/providerEvent.model.js';

import { getRouter } from './ai/index.js';
import { resolveOllama } from './ai/providers/ollamaConfig.js';

export interface Readiness {
  ready: boolean;
  database: { target: string; reachable: boolean; latencyMs: number | null };
  providers: { configured: string[]; count: number; ollama: OllamaStatus };
}

export interface OllamaStatus {
  /** 'cloud' when OLLAMA_API_KEY is set, otherwise the local daemon. */
  mode: 'local' | 'cloud';
  model: string;
}

/**
 * How Ollama is configured.
 *
 * Worth surfacing because the two modes are genuinely different answers: a
 * small local model that may struggle on a long contract, versus a large hosted
 * one. The UI tells the reader which served their document rather than letting
 * a thin answer pass for a full one (R2.11).
 */
export function ollamaStatus(): OllamaStatus {
  const env = getEnv();
  const { mode, model } = resolveOllama({
    OLLAMA_BASE_URL: env.OLLAMA_BASE_URL,
    OLLAMA_API_KEY: env.OLLAMA_API_KEY,
    OLLAMA_MODEL: env.OLLAMA_MODEL,
  });
  return { mode, model };
}

/**
 * Which providers this process could actually call.
 *
 * A key that is absent — or blank, which a copied `.env` produces — means that
 * provider is simply not in the chain (R2.8). Ollama is always listed because
 * it needs no key; whether it answers is a separate question.
 *
 * @returns Provider ids in failover order.
 */
export function configuredProviders(): string[] {
  const env = getEnv();
  return [
    ...(env.GEMINI_API_KEY !== undefined ? ['gemini'] : []),
    ...(env.GROQ_API_KEY !== undefined ? ['groq'] : []),
    ...(env.MISTRAL_API_KEY !== undefined ? ['mistral'] : []),
    'ollama',
  ];
}

/**
 * Readiness: can this process actually serve a request?
 *
 * The database is the only hard dependency. Zero cloud provider keys is a
 * supported configuration, not a failure — the app is designed to fall through
 * to local inference.
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
    providers: { configured, count: configured.length, ollama: ollamaStatus() },
  };
}

/**
 * Per-provider health over the last day, for the live status strip (R2.6).
 *
 * @returns One entry per provider seen, plus the currently configured list.
 */
export async function providerHealth(): Promise<{
  configured: string[];
  ollama: OllamaStatus;
  breakers: Record<string, { open: boolean; failures: number }>;
  recent: providerEventModel.ProviderHealth[];
}> {
  return {
    configured: configuredProviders(),
    ollama: ollamaStatus(),
    // Live circuit state, so the status strip can show a provider being skipped
    // rather than only reporting it after the fact.
    breakers: getRouter().snapshot(),
    recent: await providerEventModel.healthSince(24),
  };
}
