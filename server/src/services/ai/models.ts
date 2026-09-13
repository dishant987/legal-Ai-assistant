import type { ProviderId } from './types.js';

/**
 * Which model each provider uses.
 *
 * Gathered in one file on purpose: model names churn faster than anything else
 * in this codebase, and a rename should be a one-line change rather than a hunt
 * through four adapters.
 *
 * Ollama is absent on purpose: its model depends on whether it is running
 * locally or in the cloud, so it is resolved in providers/ollamaConfig.ts.
 *
 * ponytail: plain constants. Promote to environment variables only if we ever
 * need to switch models per deployment.
 */
export const MODELS: Record<Exclude<ProviderId, 'ollama'>, string> = {
  // The only provider that reads a PDF or a photograph natively, with no OCR
  // step to break on stamp paper.
  // Note: the Gemini 2.x line was shut down on 1 June 2026. Anything starting
  // "gemini-2" here would fail on every call.
  gemini: 'gemini-3.8-flash',
  groq: 'llama-3.3-70b-versatile',
  mistral: 'mistral-small-latest',
};
