import { describe, expect, it } from 'vitest';

import { resolveConnection } from './dbUrl.js';

const LOCAL = 'postgresql://postgres:postgres@localhost:5432/legal_assist';
const NEON_POOLED =
  'postgresql://user:pass@ep-cool-name-123456-pooler.ap-south-1.aws.neon.tech/neondb?sslmode=require';
const NEON_DIRECT =
  'postgresql://user:pass@ep-cool-name-123456.ap-south-1.aws.neon.tech/neondb?sslmode=require';

describe('resolveConnection', () => {
  it('treats a plain localhost URL as local, with TLS off', () => {
    const { target, ssl } = resolveConnection(LOCAL);
    expect(target).toBe('local');
    expect(ssl).toBe(false);
  });

  it('detects Neon from the hostname, on both the pooled and direct endpoints', () => {
    expect(resolveConnection(NEON_POOLED).target).toBe('neon');
    expect(resolveConnection(NEON_DIRECT).target).toBe('neon');
  });

  it('verifies the certificate on Neon rather than waving TLS through', () => {
    // rejectUnauthorized: false would encrypt the connection while accepting
    // any certificate, which defeats the point of requiring TLS.
    expect(resolveConnection(NEON_POOLED).ssl).toEqual({ rejectUnauthorized: true });
  });

  it('honours sslmode=require on a non-Neon host, so managed Postgres works too', () => {
    const { target, ssl } = resolveConnection(`${LOCAL}?sslmode=require`);
    expect(target).toBe('local');
    expect(ssl).toEqual({ rejectUnauthorized: true });
  });

  it('ignores sslmode values other than require', () => {
    expect(resolveConnection(`${LOCAL}?sslmode=disable`).ssl).toBe(false);
    expect(resolveConnection(`${LOCAL}?sslmode=prefer`).ssl).toBe(false);
  });

  it('keeps the Neon pool small and the local pool large', () => {
    expect(resolveConnection(NEON_POOLED).max).toBe(5);
    expect(resolveConnection(LOCAL).max).toBe(10);
  });

  it('does not mistake a lookalike host for Neon', () => {
    // Guards against a substring check: "not-neon.tech.example.com" must not match.
    expect(resolveConnection('postgresql://u:p@neon.tech.example.com:5432/db').target).toBe('local');
  });

  it('rejects a string that is not a URL, at startup rather than at first query', () => {
    expect(() => resolveConnection('not-a-url')).toThrow(TypeError);
  });
});
