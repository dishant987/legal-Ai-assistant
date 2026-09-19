import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { closeDb } from '../lib/db.js';
import { verifyFileType } from '../middleware/upload.js';
import { analysisEventSchema } from '../types/events.js';

const app = createApp();

afterAll(async () => {
  await closeDb();
});

/** Parse an SSE body back into events. */
function parseEvents(body: string): { event: string; data: unknown }[] {
  return body
    .split('\n\n')
    .filter((block) => block.trim() !== '')
    .map((block) => {
      const event = /^event: (.+)$/m.exec(block)?.[1] ?? '';
      const data = /^data: (.+)$/m.exec(block)?.[1] ?? '{}';
      return { event, data: JSON.parse(data) as unknown };
    });
}

const CONTRACT =
  'RENT AGREEMENT. The Tenant shall pay a security deposit of six months rent. ' +
  'The Landlord may enter at any time without notice.';

describe('POST /api/v1/analyses — transport', () => {
  it('responds as an event stream, not JSON', async () => {
    const res = await request(app).post('/api/v1/analyses').send({ text: CONTRACT });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.headers['cache-control']).toContain('no-cache');
    // Buffering proxies would defeat the point of streaming entirely.
    expect(res.headers['x-accel-buffering']).toBe('no');
  });

  it('emits well-formed events that satisfy the shared schema', async () => {
    const res = await request(app).post('/api/v1/analyses').send({ text: CONTRACT });
    const events = parseEvents(res.text);

    expect(events.length).toBeGreaterThan(0);
    for (const { event, data } of events) {
      expect(() => analysisEventSchema.parse(data)).not.toThrow();
      expect((data as { type: string }).type).toBe(event);
    }
  });

  it('ends the stream rather than leaving the connection hanging', async () => {
    const res = await request(app).post('/api/v1/analyses').send({ text: CONTRACT });
    expect(res.text.endsWith('\n\n')).toBe(true);
  });

  it('delivers failures as an error event, since the status line is long gone', async () => {
    // Tests run with no provider keys, so the chain is empty and there is
    // nothing to call. The stream must still close cleanly with a coded,
    // translated, traceable error rather than a dead socket.
    const res = await request(app).post('/api/v1/analyses').send({ text: CONTRACT });
    const last = parseEvents(res.text).at(-1);

    expect(last?.event).toBe('error');
    const data = last?.data as { code: string; message: string; requestId: string; retryable: boolean };

    expect(data.code).toBe('ALL_PROVIDERS_FAILED');
    expect(data.retryable).toBe(true);
    expect(data.requestId).toBeTruthy();
    // The human sentence, not a transport failure from some provider's SDK.
    expect(data.message).not.toMatch(/ECONNREFUSED|ENOTFOUND|fetch failed|ollama\.com/i);
  });
});

describe('POST /api/v1/analyses — input validation', () => {
  it('rejects a request with neither a file nor text', async () => {
    const res = await request(app).post('/api/v1/analyses').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('rejects text too short to be a document', async () => {
    const res = await request(app).post('/api/v1/analyses').send({ text: 'hi' });
    expect(res.status).toBe(400);
  });

  it('defaults to not storing the document (R3.6)', async () => {
    // Absent `store` must mean false, not undefined-and-therefore-truthy.
    const res = await request(app).post('/api/v1/analyses').send({ text: CONTRACT });
    const document = parseEvents(res.text).find((e) => e.event === 'document');
    if (document) expect((document.data as { documentId: string }).documentId).toBe('');
  });
});

describe('verifyFileType — trust the bytes, not the client', () => {
  const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x25]);
  // Signature plus a complete IHDR chunk — file-type needs more than the
  // 8-byte magic to commit to a verdict.
  const PNG = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00,
    0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89,
  ]);
  const ZIP = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0, 0, 0, 0, 0]);

  it('identifies a PDF from its signature', async () => {
    await expect(verifyFileType(PDF, 'application/pdf')).resolves.toBe('application/pdf');
  });

  it('identifies a PNG from its signature', async () => {
    await expect(verifyFileType(PNG, 'image/png')).resolves.toBe('image/png');
  });

  it('catches a file lying about its type', async () => {
    // A zip renamed to .pdf: the declared type says PDF, the bytes say zip.
    await expect(verifyFileType(ZIP, 'application/pdf')).rejects.toMatchObject({
      code: 'UNSUPPORTED_TYPE',
    });
  });

  it('accepts plain text, which has no signature to check', async () => {
    const text = new TextEncoder().encode('4. SECURITY DEPOSIT\nSix months rent.');
    await expect(verifyFileType(text, 'text/plain')).resolves.toBe('text/plain');
  });

  it('rejects binary garbage claiming to be text', async () => {
    const garbage = new Uint8Array([0xff, 0xfe, 0xfd, 0xfc, 0x00, 0x01, 0x02, 0x03]);
    await expect(verifyFileType(garbage, 'text/plain')).rejects.toMatchObject({
      code: 'UNSUPPORTED_TYPE',
    });
  });
});
