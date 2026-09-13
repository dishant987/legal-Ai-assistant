import { sql } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { closeDb, getDb } from '../../lib/db.js';
import { documents } from '../../models/schema.js';
import type { AnalysisEvent } from '../../types/events.js';
import type { Router } from '../ai/router.js';

import { analyse } from './pipeline.js';
import { ingestFile } from './stages/ingest.js';

const reachable = await (async (): Promise<boolean> => {
  try {
    await getDb().execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
})();

const DOC =
  'RENT AGREEMENT. The Tenant shall pay a security deposit of six months rent. ' +
  'The Landlord may enter at any time without notice.';

let calls = 0;

const router: Router = {
  complete: (req) => {
    calls += 1;
    const answer =
      req.stage === 'ingest'
        ? { text: DOC, docType: 'rent-agreement', parties: ['landlord', 'tenant'] }
        : {
            findings: [
              {
                kind: 'risk',
                severity: 'high',
                quote: 'security deposit of six months rent',
                plainText: 'Three times the usual cap for a home.',
              },
              {
                kind: 'risk',
                severity: 'critical',
                quote: 'a clause that is nowhere in this document',
                plainText: 'Invented, and it should be struck through.',
              },
            ],
          };
    return Promise.resolve({ data: req.schema.parse(answer), provider: 'gemini' as const, degraded: false });
  },
  snapshot: () => ({}),
};

async function run(store: boolean): Promise<AnalysisEvent[]> {
  const events: AnalysisEvent[] = [];
  await analyse({ text: DOC, store }, (e) => events.push(e), router);
  return events;
}

describe.skipIf(!reachable)('analysis cache (R9.1)', () => {
  beforeEach(async () => {
    await getDb().delete(documents);
    calls = 0;
  });

  afterAll(async () => {
    if (reachable) await closeDb();
  });

  it('persists the run when storage was asked for', async () => {
    const events = await run(true);
    const document = events.find((e) => e.type === 'document');

    expect(document?.documentId).not.toBe('');
    expect(events.some((e) => e.type === 'stage' && e.stage === 'persist')).toBe(true);
  });

  it('replays the second identical upload without calling a provider', async () => {
    await run(true);
    const firstRunCalls = calls;
    expect(firstRunCalls).toBeGreaterThan(0);

    calls = 0;
    const second = await run(true);

    // The whole point: the same contract twice costs one round of AI calls,
    // not two.
    expect(calls).toBe(0);
    expect(second.find((e) => e.type === 'document')?.cached).toBe(true);
  });

  it('replays the findings, rejections included', async () => {
    await run(true);
    const replayed = (await run(true)).filter((e) => e.type === 'finding');

    expect(replayed).toHaveLength(2);
    expect(replayed.filter((e) => !e.finding.verified)).toHaveLength(1);
  });

  it('replays the document text, so spans still highlight', async () => {
    await run(true);
    expect((await run(true)).find((e) => e.type === 'document')?.text).toBe(DOC);
  });

  it('replays the original counts', async () => {
    await run(true);
    expect((await run(true)).at(-1)).toMatchObject({ type: 'done', verified: 1, rejected: 1 });
  });

  it('does not cache when storage was declined — the safe default costs the cache', async () => {
    await run(false);
    calls = 0;
    await run(false);
    expect(calls).toBeGreaterThan(0);
  });
});

describe.skipIf(!reachable)('ingestFile', () => {
  afterAll(async () => {
    if (reachable) await closeDb();
  });

  it('reads plain text directly, without spending a model call', async () => {
    let used = 0;
    const counting: Router = {
      complete: (req) => {
        used += 1;
        return Promise.resolve({
          data: req.schema.parse({ text: DOC, docType: 'rent-agreement', parties: [] }),
          provider: 'gemini' as const,
          degraded: false,
        });
      },
      snapshot: () => ({}),
    };

    const result = await ingestFile(counting, {
      bytes: new TextEncoder().encode(DOC),
      mimeType: 'text/plain',
    });

    expect(result.text).toBe(DOC);
    // One call to classify it, not a second to transcribe what we can already read.
    expect(used).toBe(1);
  });

  it('refuses an empty text file rather than analysing nothing', async () => {
    await expect(
      ingestFile(router, { bytes: new TextEncoder().encode('   \n  '), mimeType: 'text/plain' }),
    ).rejects.toMatchObject({ code: 'NO_TEXT_FOUND' });
  });
});
