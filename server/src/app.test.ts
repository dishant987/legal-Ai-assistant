import express from 'express';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createApp } from './app.js';
import { closeDb } from './lib/db.js';
import { AppError } from './lib/errors.js';
import { errorHandler } from './middleware/errorHandler.js';
import { analyseLimiter } from './middleware/rateLimit.js';
import { requestId } from './middleware/requestId.js';
import { validate } from './middleware/validate.js';
import { apiErrorSchema } from './types/errors.js';
import { en, hi } from './types/messages/index.js';

const app = createApp();

afterAll(async () => {
  await closeDb();
});

describe('health', () => {
  it('GET /api/v1/health is up without touching anything else', async () => {
    const res = await request(app).get('/api/v1/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok' });
  });

  it('GET /api/v1/health/ready reports the database target', async () => {
    const res = await request(app).get('/api/v1/health/ready');
    expect([200, 503]).toContain(res.status);
    expect(res.body.database.target).toMatch(/^(local|neon)$/);
    // Readiness is exactly database reachability: zero cloud keys is supported.
    expect(res.body.ready).toBe(res.body.database.reachable);
  });

  it('GET /api/v1/health/providers always lists ollama, which needs no key', async () => {
    const res = await request(app).get('/api/v1/health/providers').expect(200);
    expect(res.body.configured).toContain('ollama');
  });
});

describe('error envelope', () => {
  it('is the same shape for a 404 as for anything else (R4.2)', async () => {
    const res = await request(app).get('/api/v1/nope').expect(404);
    expect(() => apiErrorSchema.parse(res.body)).not.toThrow();
    expect(res.body.error).toMatchObject({ code: 'NOT_FOUND', retryable: false });
  });

  it('carries a requestId that matches the response header (R4.5)', async () => {
    const res = await request(app).get('/api/v1/nope').expect(404);
    expect(res.body.error.requestId).toBe(res.headers['x-request-id']);
  });

  it('translates when Accept-Language asks for Hindi', async () => {
    const res = await request(app).get('/api/v1/nope').set('Accept-Language', 'hi-IN,hi;q=0.9');
    expect(res.body.error.message).toBe(hi.NOT_FOUND);
  });

  it('falls back to English for an unsupported language', async () => {
    const res = await request(app).get('/api/v1/nope').set('Accept-Language', 'fr-FR');
    expect(res.body.error.message).toBe(en.NOT_FOUND);
  });

  it('never leaks a stack trace or the raw exception message (R4.3)', async () => {
    const leaky = express();
    leaky.use(requestId);
    leaky.get('/boom', () => {
      throw new Error('connection to 10.0.0.4 failed: password authentication failed for "postgres"');
    });
    leaky.use(errorHandler);

    const res = await request(leaky).get('/boom').expect(500);
    const body = JSON.stringify(res.body);

    expect(res.body.error.code).toBe('INTERNAL');
    expect(res.body.error.message).toBe(en.INTERNAL);
    expect(body).not.toContain('password');
    expect(body).not.toContain('10.0.0.4');
    // A real stack frame, not the substring "at " — which occurs in ordinary
    // English ("wh-at b-roke") and would make this assertion useless.
    expect(body).not.toMatch(/\bat\s+\S+\s*\([^)]*:\d+:\d+\)/);
    expect(body).not.toMatch(/\.ts:\d+:\d+/);
    expect(res.body.error).not.toHaveProperty('stack');
    expect(res.body.error).not.toHaveProperty('detail');
  });

  it('keeps an AppError detail out of the response even though it is logged', async () => {
    const leaky = express();
    leaky.use(requestId);
    leaky.get('/boom', () => {
      throw new AppError('STORAGE_FAILED', 502, true, { bucket: 'secret-internal-bucket' });
    });
    leaky.use(errorHandler);

    const res = await request(leaky).get('/boom').expect(502);
    expect(JSON.stringify(res.body)).not.toContain('secret-internal-bucket');
    expect(res.body.error.retryable).toBe(true);
  });
});

describe('security headers', () => {
  it('sets a CSP with no CDN and no unsafe-inline (R8.1)', async () => {
    const res = await request(app).get('/api/v1/health');
    const csp = res.headers['content-security-policy'];
    expect(csp).toContain("default-src 'self'");
    expect(csp).not.toContain('unsafe-inline');
    expect(csp).not.toContain('cdn');
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('does not advertise the framework', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('requestId', () => {
  it('honours a sane inbound id so a trace survives across hops', async () => {
    const res = await request(app).get('/api/v1/health').set('X-Request-Id', 'abc123-DEF_456');
    expect(res.headers['x-request-id']).toBe('abc123-DEF_456');
  });

  it('rejects a hostile inbound id rather than echoing it into headers and logs', async () => {
    const res = await request(app).get('/api/v1/health').set('X-Request-Id', 'a'.repeat(5000));
    expect(res.headers['x-request-id']).not.toContain('aaaaaaaaaa');
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('validate', () => {
  function appWith(schema: Parameters<typeof validate>[0]) {
    const a = express();
    a.use(requestId);
    a.use(express.json());
    a.post('/x', validate(schema), (req, res) => {
      res.json(req.body);
    });
    a.use(errorHandler);
    return a;
  }

  it('reports issues per field, not as one opaque string (R4.8)', async () => {
    const a = appWith({ body: z.object({ state: z.string().min(1), pages: z.number() }) });
    const res = await request(a).post('/x').send({ state: '', pages: 'many' }).expect(400);

    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(Object.keys(res.body.error.fields)).toEqual(expect.arrayContaining(['state', 'pages']));
  });

  it('passes parsed values on, so controllers get coerced data', async () => {
    const a = appWith({ body: z.object({ pages: z.coerce.number() }) });
    const res = await request(a).post('/x').send({ pages: '42' }).expect(200);
    expect(res.body.pages).toBe(42);
  });

  it('strips unknown keys instead of carrying them deeper', async () => {
    const a = appWith({ body: z.object({ keep: z.string() }) });
    const res = await request(a).post('/x').send({ keep: 'yes', sneaky: 'no' }).expect(200);
    expect(res.body).toEqual({ keep: 'yes' });
  });
});

describe('rate limiting', () => {
  it('returns the standard envelope rather than express-rate-limit plain text', async () => {
    const a = express();
    a.use(requestId);
    a.get('/x', analyseLimiter, (_req, res) => {
      res.json({ ok: true });
    });
    a.use(errorHandler);

    // analyseLimiter allows 10 per hour; the 11th must be rejected.
    for (let i = 0; i < 10; i++) await request(a).get('/x').expect(200);
    const res = await request(a).get('/x').expect(429);

    expect(() => apiErrorSchema.parse(res.body)).not.toThrow();
    expect(res.body.error).toMatchObject({ code: 'RATE_LIMITED', retryable: true });
    expect(res.body.error.message).toBe(en.RATE_LIMITED);
  });
});
