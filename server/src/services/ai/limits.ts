import type { ProviderId } from './types.js';

export interface ProviderLimits {
  /** Free-tier tokens per minute. The binding constraint for most stages. */
  tpm: number;
  /** Largest context the model accepts. */
  context: number;
}

/**
 * Free-tier ceilings, as published.
 *
 * These exist because the naive failover chain is a lie without them (R2.10).
 * Groq allows 6,000 tokens per minute; a twenty-page contract is 15,000-25,000.
 * A whole-document `extract` call can therefore *never* be served by Groq — it
 * would 429 on every single attempt.
 *
 * So the router skips a provider whose ceiling the request exceeds, rather than
 * spending a request to rediscover that. The practical consequence shapes the
 * pipeline: whole-document stages run on Gemini, Mistral or Ollama, while
 * per-clause stages are small enough that all four providers are genuinely
 * available. That is the real argument for per-clause staging — not elegance,
 * but the fact that it is what makes a four-provider chain honest.
 *
 * ponytail: a static table. Read the providers' own rate-limit headers only if
 * we ever find these drifting in practice.
 */
export const LIMITS: Record<ProviderId, ProviderLimits> = {
  gemini: { tpm: 1_000_000, context: 1_000_000 },
  groq: { tpm: 6_000, context: 128_000 },
  mistral: { tpm: 40_000, context: 128_000 },
  // Local inference has no quota. It is slow and weaker, not rate-limited.
  ollama: { tpm: Number.POSITIVE_INFINITY, context: 128_000 },
};

/**
 * Very rough token estimate.
 *
 * Four characters per token is the usual English approximation. It only has to
 * be good enough to tell a 500-token clause from a 20,000-token contract, which
 * is the only decision it feeds.
 *
 * @param text - The prompt, or the document.
 * @returns Estimated tokens.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
