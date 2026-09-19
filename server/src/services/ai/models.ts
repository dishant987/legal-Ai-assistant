import type { ProviderId } from './types.js';

/**
 * Which model each provider uses.
 *
 * Gathered in one file on purpose: model names churn faster than anything else
 * in this codebase, and a rename should be a one-line change rather than a hunt
 * through four adapters.
 *
 * ponytail: plain constants. Promote to environment variables only if we ever
 * need to switch models per deployment.
 */
export const MODELS: Record<ProviderId, string> = {
  // The only provider that reads a PDF or a photograph natively, with no OCR
  // step to break on stamp paper.
  // Note: the Gemini 2.x line was shut down on 1 June 2026. Anything starting
  // "gemini-2" here would fail on every call.
  gemini: 'gemini-3.8-flash',
  groq: 'llama-3.3-70b-versatile',
  mistral: 'mistral-small-latest',
  // Overridable with OLLAMA_MODEL, because this catalogue churns faster than
  // any other provider's — `GET https://ollama.com/v1/models` lists what your
  // key can actually reach.
  //
  // Note: a LOCAL tag such as "llama3.2" is not a cloud model, and the hosted
  // API answers an unavailable model with 401 Unauthorized rather than 404 —
  // which reads like a bad key and is not.
  ollama: 'gpt-oss:120b',
};

/** Ollama's hosted API. There is no local mode. */
export const OLLAMA_HOST = 'https://ollama.com';
