import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

import { getEnv, parseEnv, resetEnvCache } from './env.js';

const valid = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/legal_assist',
} satisfies NodeJS.ProcessEnv;

describe('parseEnv', () => {
  beforeEach(resetEnvCache);

  it('accepts a minimal environment and applies defaults', () => {
    const env = parseEnv(valid);
    expect(env.PORT).toBe(3001);
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.OLLAMA_BASE_URL).toBe('http://localhost:11434');
  });

  it('runs with zero AI provider keys — every provider is optional (R2.8)', () => {
    const env = parseEnv(valid);
    expect(env.GEMINI_API_KEY).toBeUndefined();
    expect(env.GROQ_API_KEY).toBeUndefined();
    expect(env.MISTRAL_API_KEY).toBeUndefined();
  });

  it('coerces PORT from a string', () => {
    expect(parseEnv({ ...valid, PORT: '8080' }).PORT).toBe(8080);
  });

  it('parses DEMO into a real boolean, not the string "false"', () => {
    expect(parseEnv({ ...valid, DEMO: 'true' }).DEMO).toBe(true);
    expect(parseEnv({ ...valid, DEMO: 'false' }).DEMO).toBe(false);
    expect(parseEnv(valid).DEMO).toBe(false);
  });

  it('rejects a missing DATABASE_URL', () => {
    expect(() => parseEnv({ NODE_ENV: 'test' })).toThrow(/DATABASE_URL/);
  });

  it('rejects a malformed DATABASE_URL rather than failing later at connect time', () => {
    expect(() => parseEnv({ ...valid, DATABASE_URL: 'not-a-url' })).toThrow(/DATABASE_URL/);
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => parseEnv({ ...valid, NODE_ENV: 'staging' })).toThrow();
  });

  it('rejects an empty provider key — absent is valid, blank is a typo', () => {
    expect(() => parseEnv({ ...valid, GEMINI_API_KEY: '' })).toThrow(/GEMINI_API_KEY/);
  });
});

describe('getEnv', () => {
  beforeEach(() => {
    resetEnvCache();
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('DATABASE_URL', valid.DATABASE_URL);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('memoises, so the schema is parsed once per process', () => {
    expect(getEnv()).toBe(getEnv());
  });

  it('has no import side effect — nothing is parsed until it is called', () => {
    vi.stubEnv('DATABASE_URL', 'not-a-url');
    resetEnvCache();
    expect(() => getEnv()).toThrow(/DATABASE_URL/);
  });
});
