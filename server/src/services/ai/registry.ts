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
 * throws on first use (R2.8). The app is expected to run with zero cloud keys,
 * falling all the way through to local inference.
 *
 * Order is the failover order: Gemini first because it alone reads documents
 * natively, then Groq for speed on small requests, Mistral for the larger ones,
 * and Ollama last because it always answers.
 *
 * @param env - Environment, injectable for tests.
 * @returns Providers in failover order. Never empty — Ollama needs no key.
 */
export function buildProviders(env = getEnv()): Provider[] {
  const providers: Provider[] = [];

  if (env.GEMINI_API_KEY !== undefined) providers.push(createGeminiProvider(env.GEMINI_API_KEY));
  if (env.GROQ_API_KEY !== undefined) providers.push(createGroqProvider(env.GROQ_API_KEY));
  if (env.MISTRAL_API_KEY !== undefined) providers.push(createMistralProvider(env.MISTRAL_API_KEY));
  providers.push(
    createOllamaProvider({
      OLLAMA_BASE_URL: env.OLLAMA_BASE_URL,
      OLLAMA_API_KEY: env.OLLAMA_API_KEY,
      OLLAMA_MODEL: env.OLLAMA_MODEL,
    }),
  );

  return providers;
}
