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
  OLLAMA_BASE_URL: 'http://localhost:11434',
} as Env;

describe('buildProviders', () => {
  it('runs with zero cloud keys, falling through to local inference (R2.8)', () => {
    const providers = buildProviders(base);
    expect(providers.map((p) => p.id)).toEqual(['ollama']);
  });

  it('never returns an empty chain — ollama needs no key', () => {
    expect(buildProviders(base).length).toBeGreaterThan(0);
  });

  it('adds each provider only when its key is present', () => {
    const providers = buildProviders({ ...base, GROQ_API_KEY: 'k' });
    expect(providers.map((p) => p.id)).toEqual(['groq', 'ollama']);
  });

  it('orders the full chain by preference, not alphabetically', () => {
    const providers = buildProviders({
      ...base,
      GEMINI_API_KEY: 'a',
      GROQ_API_KEY: 'b',
      MISTRAL_API_KEY: 'c',
    });
    expect(providers.map((p) => p.id)).toEqual(['gemini', 'groq', 'mistral', 'ollama']);
  });

  it('marks only Gemini as able to read a document natively', () => {
    const providers = buildProviders({
      ...base,
      GEMINI_API_KEY: 'a',
      GROQ_API_KEY: 'b',
      MISTRAL_API_KEY: 'c',
    });
    const fileCapable = providers.filter((p) => p.supportsFiles).map((p) => p.id);
    expect(fileCapable).toEqual(['gemini']);
  });

  it('constructs adapters without calling out to anything', () => {
    // Building the chain must be free: it happens at boot, and a network call
    // here would make startup depend on four external services being up.
    expect(() =>
      buildProviders({ ...base, GEMINI_API_KEY: 'a', GROQ_API_KEY: 'b', MISTRAL_API_KEY: 'c' }),
    ).not.toThrow();
  });
});
