import { sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { closeDb, getDb } from '../lib/db.js';

import * as analysisModel from './analysis.model.js';
import * as documentModel from './document.model.js';
import { documents, findings } from './schema.js';

const reachable = await (async (): Promise<boolean> => {
  try {
    await getDb().execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
})();

const finding = (quote: string, verified = true) => ({
  kind: 'risk' as const,
  severity: 'high' as const,
  quote,
  charStart: 0,
  charEnd: quote.length,
  plainText: 'This clause is worse for you than the market standard.',
  verified,
});

describe.skipIf(!reachable)('analysis model', () => {
  beforeEach(async () => {
    await getDb().delete(documents);
  });

  afterAll(async () => {
    if (reachable) await closeDb();
  });

  async function newDocument() {
    return documentModel.create({
      contentHash: Math.random().toString(36).repeat(12).slice(0, 64),
      docType: 'rent-agreement',
      text: 'The Tenant shall pay a security deposit of six months rent.',
      stored: true,
    });
  }

  it('stores an analysis with its findings', async () => {
    const document = await newDocument();
    await analysisModel.create(
      {
        documentId: document.id,
        providerUsed: 'gemini',
        durationMs: 1200,
        verifiedCount: 2,
        rejectedCount: 0,
      },
      [finding('security deposit'), finding('six months rent')],
    );

    const stored = await analysisModel.latestForDocument(document.id);
    expect(stored?.findings).toHaveLength(2);
    expect(stored?.providerUsed).toBe('gemini');
  });

  it('keeps rejected findings, so the strike-through survives a reload', async () => {
    const document = await newDocument();
    await analysisModel.create(
      { documentId: document.id, providerUsed: 'gemini', durationMs: 10, verifiedCount: 1, rejectedCount: 1 },
      [finding('security deposit'), finding('a clause that was never there', false)],
    );

    const stored = await analysisModel.latestForDocument(document.id);
    expect(stored?.findings.filter((f) => !f.verified)).toHaveLength(1);
    expect(stored?.rejectedCount).toBe(1);
  });

  it('rolls back entirely when a finding is invalid', async () => {
    // A run that recorded its counts but lost its findings would look
    // successful and then serve an empty result from cache forever.
    const document = await newDocument();

    await expect(
      analysisModel.create(
        {
          documentId: document.id,
          providerUsed: 'gemini',
          durationMs: 10,
          verifiedCount: 1,
          rejectedCount: 0,
        },
        [{ ...finding('valid one'), severity: 'not-a-severity' as never }],
      ),
    ).rejects.toThrow();

    expect(await analysisModel.latestForDocument(document.id)).toBeUndefined();
    expect(await getDb().select().from(findings)).toHaveLength(0);
  });

  it('accepts an analysis with no findings — a clean contract is a real answer', async () => {
    const document = await newDocument();
    await analysisModel.create(
      { documentId: document.id, providerUsed: 'gemini', durationMs: 10, verifiedCount: 0, rejectedCount: 0 },
      [],
    );

    expect(await analysisModel.latestForDocument(document.id)).toBeDefined();
  });

  it('returns the most recent run when a document is analysed twice', async () => {
    const document = await newDocument();
    for (const provider of ['ollama', 'gemini']) {
      await analysisModel.create(
        {
          documentId: document.id,
          providerUsed: provider,
          durationMs: 10,
          verifiedCount: 0,
          rejectedCount: 0,
        },
        [],
      );
    }

    expect((await analysisModel.latestForDocument(document.id))?.providerUsed).toBe('gemini');
  });

  it('returns undefined for a document that was never analysed', async () => {
    const document = await newDocument();
    expect(await analysisModel.latestForDocument(document.id)).toBeUndefined();
  });

  it('cascades findings away when the document is purged', async () => {
    const document = await newDocument();
    await analysisModel.create(
      { documentId: document.id, providerUsed: 'gemini', durationMs: 10, verifiedCount: 1, rejectedCount: 0 },
      [finding('security deposit')],
    );

    await documentModel.remove(document.id);
    expect(await getDb().select().from(findings)).toHaveLength(0);
  });
});
