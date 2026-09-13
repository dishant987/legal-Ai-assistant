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
  // Small enough to run on a laptop. Weaker, and the UI says so (R2.11).
  ollama: 'llama3.2',
};
