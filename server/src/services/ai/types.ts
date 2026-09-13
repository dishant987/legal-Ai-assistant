import type { ZodType } from 'zod';

export type ProviderId = 'gemini' | 'groq' | 'mistral' | 'ollama';

/** Why an attempt ended. Mirrors the `provider_outcome` enum in the database. */
export type Outcome = 'ok' | 'timeout' | 'rate_limited' | 'http_error' | 'parse_error' | 'skipped';

/** A document handed to a provider that can read files natively. */
export interface FileRef {
  bytes: Uint8Array;
  mimeType: string;
}

/** What the router asks a provider for. */
export interface RawRequest {
  prompt: string;
  temperature: number;
  /** JSON Schema, for providers that can constrain generation to it. */
  jsonSchema?: unknown;
  file?: FileRef;
}

/**
 * One AI backend.
 *
 * Adapters do exactly one thing: call their SDK asking for JSON and return the
 * parsed object. They know nothing about retries, timeouts, circuit breakers,
 * telemetry or Zod — all of that lives in the router, once, rather than four
 * times.
 */
export interface Provider {
  readonly id: ProviderId;
  /** Whether this provider accepts a document directly, with no OCR step. */
  readonly supportsFiles: boolean;
  complete(req: RawRequest): Promise<unknown>;
}

/** What a caller asks the router for. */
export interface CompleteRequest<T> {
  /** Pipeline stage name, for telemetry. */
  stage: string;
  prompt: string;
  /** The contract. Also what makes four different backends interchangeable. */
  schema: ZodType<T>;
  temperature: number;
  /**
   * Rough token cost of this call.
   *
   * Used to skip providers that cannot serve it (R2.10). Groq's free tier caps
   * at 6,000 tokens per minute, so a whole-document request would 429 every
   * time — sending it anyway would burn a request to learn what we already knew.
   */
  estimatedTokens: number;
  file?: FileRef;
}

export interface Completion<T> {
  data: T;
  provider: ProviderId;
  /** True when the primary provider was unavailable — the UI says so (R2.11). */
  degraded: boolean;
}

export interface Attempt {
  provider: ProviderId;
  outcome: Outcome;
  latencyMs: number;
  reason?: string;
}
