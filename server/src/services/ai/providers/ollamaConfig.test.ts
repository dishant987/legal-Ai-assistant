import { describe, expect, it } from 'vitest';

import { OLLAMA_CLOUD_HOST, resolveOllama } from './ollamaConfig.js';

const LOCAL = 'http://localhost:11434';

describe('resolveOllama — no key', () => {
  it('uses the local daemon, with no Authorization header', () => {
    const config = resolveOllama({ OLLAMA_BASE_URL: LOCAL });

    expect(config.mode).toBe('local');
    expect(config.host).toBe(LOCAL);
    expect(config.headers).toEqual({});
  });

  it('treats a blank key as no key, which a copied .env produces', () => {
    expect(resolveOllama({ OLLAMA_BASE_URL: LOCAL, OLLAMA_API_KEY: '' }).mode).toBe('local');
    expect(resolveOllama({ OLLAMA_BASE_URL: LOCAL, OLLAMA_API_KEY: '   ' }).mode).toBe('local');
  });

  it('respects a custom local host, e.g. another machine on the network', () => {
    const config = resolveOllama({ OLLAMA_BASE_URL: 'http://192.168.1.50:11434' });
    expect(config.host).toBe('http://192.168.1.50:11434');
  });

  it('defaults to a model small enough to run on a laptop', () => {
    expect(resolveOllama({ OLLAMA_BASE_URL: LOCAL }).model).toBe('llama3.2');
  });
});

describe('resolveOllama — with a key', () => {
  const key = 'ollama-secret-key';

  it('switches to the hosted API', () => {
    const config = resolveOllama({ OLLAMA_BASE_URL: LOCAL, OLLAMA_API_KEY: key });

    expect(config.mode).toBe('cloud');
    expect(config.host).toBe(OLLAMA_CLOUD_HOST);
  });

  it('sends the key as a bearer token', () => {
    const config = resolveOllama({ OLLAMA_BASE_URL: LOCAL, OLLAMA_API_KEY: key });
    expect(config.headers).toEqual({ Authorization: `Bearer ${key}` });
  });

  it('overrides a leftover localhost URL rather than posting the key to localhost', () => {
    // Setting a cloud key while OLLAMA_BASE_URL still says localhost is the
    // obvious mistake. Sending the credential to a local daemon would fail in a
    // confusing way, so the cloud host wins.
    expect(resolveOllama({ OLLAMA_BASE_URL: LOCAL, OLLAMA_API_KEY: key }).host).toBe(OLLAMA_CLOUD_HOST);
  });

  it('keeps an explicitly different host, for a self-hosted instance behind auth', () => {
    const config = resolveOllama({
      OLLAMA_BASE_URL: 'https://ollama.internal.example.com',
      OLLAMA_API_KEY: key,
    });
    expect(config.host).toBe('https://ollama.internal.example.com');
    expect(config.mode).toBe('cloud');
  });

  it('defaults to a hosted model, not the laptop one', () => {
    const config = resolveOllama({ OLLAMA_BASE_URL: LOCAL, OLLAMA_API_KEY: key });
    expect(config.model).toContain('cloud');
  });

  it('lets OLLAMA_MODEL override either default — the catalogue churns', () => {
    expect(
      resolveOllama({ OLLAMA_BASE_URL: LOCAL, OLLAMA_API_KEY: key, OLLAMA_MODEL: 'qwen3.5:cloud' }).model,
    ).toBe('qwen3.5:cloud');
    expect(resolveOllama({ OLLAMA_BASE_URL: LOCAL, OLLAMA_MODEL: 'mistral:7b' }).model).toBe('mistral:7b');
  });

  it('never leaks the key into the host', () => {
    const config = resolveOllama({ OLLAMA_BASE_URL: LOCAL, OLLAMA_API_KEY: key });
    expect(config.host).not.toContain(key);
  });
});
