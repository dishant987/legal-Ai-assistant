import { describe, expect, it } from 'vitest';

import type { Env } from '../../config/env.js';

import { buildProviders } from './registry.js';

const base = {
  NODE_ENV: 'test',
  PORT: 3001,
  LOG_LEVEL: 'silent',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  CORS_ORIGIN: 'http://localhost:5173',
  DEMO: false,
} as Env;

describe('buildProviders', () => {
  it('returns an empty chain when no keys are configured', () => {
    // Every provider is a hosted service now, so this is a legitimate state:
    // the server starts, and analyses fail with ALL_PROVIDERS_FAILED.
    expect(buildProviders(base)).toEqual([]);
  });

  it('adds each provider only when its key is present', () => {
    const providers = buildProviders({ ...base, GROQ_API_KEY: 'k' });
    expect(providers.map((p) => p.id)).toEqual(['groq']);
  });

  it('includes Ollama only with a key, like every other provider', () => {
    expect(buildProviders({ ...base, OLLAMA_API_KEY: 'k' }).map((p) => p.id)).toEqual(['ollama']);
  });

  it('orders the full chain by preference, not alphabetically', () => {
    const providers = buildProviders({
      ...base,
      GEMINI_API_KEY: 'a',
      GROQ_API_KEY: 'b',
      MISTRAL_API_KEY: 'c',
      OLLAMA_API_KEY: 'd',
    });
    expect(providers.map((p) => p.id)).toEqual(['gemini', 'groq', 'mistral', 'ollama']);
  });

  it('marks only Gemini as able to read a document natively', () => {
    const providers = buildProviders({
      ...base,
      GEMINI_API_KEY: 'a',
      GROQ_API_KEY: 'b',
      MISTRAL_API_KEY: 'c',
      OLLAMA_API_KEY: 'd',
    });
    const fileCapable = providers.filter((p) => p.supportsFiles).map((p) => p.id);
    expect(fileCapable).toEqual(['gemini']);
  });

  it('constructs adapters without calling out to anything', () => {
    // Building the chain must be free: it happens at boot, and a network call
    // here would make startup depend on four external services being up.
    expect(() =>
      buildProviders({
        ...base,
        GEMINI_API_KEY: 'a',
        GROQ_API_KEY: 'b',
        MISTRAL_API_KEY: 'c',
        OLLAMA_API_KEY: 'd',
      }),
    ).not.toThrow();
  });
});
