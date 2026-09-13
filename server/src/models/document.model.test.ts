import { sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { closeDb, getDb, getDbTarget } from '../lib/db.js';

import * as documentModel from './document.model.js';
import { analyses, documents, findings, obligations } from './schema.js';

/**
 * Integration tests against a real Postgres.
 *
 * Skipped automatically when no database is reachable, so a clean clone with no
 * DATABASE_URL still runs green (R7.12). CI provides one, and these must pass
 * there — constraints and cascades are exactly the things a mock would fake.
 */
const reachable = await (async (): Promise<boolean> => {
  try {
    await getDb().execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
})();

describe.skipIf(!reachable)(`document model (${reachable ? getDbTarget() : 'no database'})`, () => {
  beforeEach(async () => {
    await getDb().delete(documents);
  });

  afterAll(async () => {
    if (reachable) await closeDb();
  });

  const sample = { contentHash: 'a'.repeat(64), docType: 'rent-agreement' };

  it('round-trips a document and finds it by content hash', async () => {
    const created = await documentModel.create(sample);
    const found = await documentModel.findByContentHash(sample.contentHash);
    expect(found?.id).toBe(created.id);
  });

  it('returns undefined for an unknown hash rather than throwing', async () => {
    expect(await documentModel.findByContentHash('b'.repeat(64))).toBeUndefined();
  });

  it('rejects a duplicate content hash — the cache key must stay unique (R9.1)', async () => {
    await documentModel.create(sample);
    await expect(documentModel.create(sample)).rejects.toThrow();
  });

  it('defaults to not stored, matching the privacy-first default (R3.6)', async () => {
    const created = await documentModel.create(sample);
    expect(created.stored).toBe(false);
    expect(created.cloudinaryPublicId).toBeNull();
  });

  it('cascades analyses, findings and obligations when a document is deleted', async () => {
    const doc = await documentModel.create(sample);
    const [analysis] = await getDb()
      .insert(analyses)
      .values({ documentId: doc.id, providerUsed: 'gemini', durationMs: 1200 })
      .returning();

    await getDb().insert(findings).values({
      analysisId: analysis!.id,
      kind: 'risk',
      severity: 'high',
      quote: 'the security deposit shall be six months rent',
      charStart: 0,
      charEnd: 44,
      plainText: 'Your deposit is three times the legal cap.',
    });
    await getDb()
      .insert(obligations)
      .values({ analysisId: analysis!.id, party: 'tenant', duty: 'Pay rent by the 5th' });

    await documentModel.remove(doc.id);

    expect(await getDb().select().from(analyses)).toHaveLength(0);
    expect(await getDb().select().from(findings)).toHaveLength(0);
    expect(await getDb().select().from(obligations)).toHaveLength(0);
  });

  it('purges only documents past the retention window (R3.5)', async () => {
    const old = await documentModel.create({ ...sample, cloudinaryPublicId: 'legal-assist/old' });
    await documentModel.create({ contentHash: 'c'.repeat(64) });

    await getDb()
      .update(documents)
      .set({ createdAt: sql`now() - interval '25 hours'` })
      .where(sql`${documents.id} = ${old.id}`);

    const purgedAssets = await documentModel.purgeOlderThan(24);

    expect(purgedAssets).toEqual(['legal-assist/old']);
    const remaining = await getDb().select().from(documents);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.contentHash).toBe('c'.repeat(64));
  });

  it('returns no asset ids when the purged documents were never stored', async () => {
    const doc = await documentModel.create(sample);
    await getDb()
      .update(documents)
      .set({ createdAt: sql`now() - interval '25 hours'` })
      .where(sql`${documents.id} = ${doc.id}`);

    expect(await documentModel.purgeOlderThan(24)).toEqual([]);
  });
});
