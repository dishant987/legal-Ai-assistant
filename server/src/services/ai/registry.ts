import { getEnv } from '../../config/env.js';

import { createGeminiProvider } from './providers/gemini.js';
import { createGroqProvider } from './providers/groq.js';
import { createMistralProvider } from './providers/mistral.js';
import { createOllamaProvider } from './providers/ollama.js';
import type { Provider } from './types.js';

/**
 * Build the provider chain from whatever credentials exist.
 *
 * A provider with no key is simply absent — never a crash, never a stub that
 * throws on first use (R2.8).
 *
 * Every provider is a hosted service, so the chain can legitimately come back
 * empty. The server still starts; analyses then fail with
 * ALL_PROVIDERS_FAILED, which is honest — there is nothing to call.
 *
 * Order is the failover order: Gemini first because it alone reads documents
 * natively, then Groq for speed on small requests, Mistral for the larger ones,
 * and Ollama last as the deepest fallback.
 *
 * @param env - Environment, injectable for tests.
 * @returns Providers in failover order. May be empty.
 */
export function buildProviders(env = getEnv()): Provider[] {
  const providers: Provider[] = [];

  if (env.GEMINI_API_KEY !== undefined) providers.push(createGeminiProvider(env.GEMINI_API_KEY));
  if (env.GROQ_API_KEY !== undefined) providers.push(createGroqProvider(env.GROQ_API_KEY));
  if (env.MISTRAL_API_KEY !== undefined) providers.push(createMistralProvider(env.MISTRAL_API_KEY));
  if (env.OLLAMA_API_KEY !== undefined) {
    providers.push(createOllamaProvider(env.OLLAMA_API_KEY, env.OLLAMA_MODEL));
  }

  return providers;
}
