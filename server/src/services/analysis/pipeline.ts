import { createHash } from 'node:crypto';

import * as analysisModel from '../../models/analysis.model.js';
import * as documentModel from '../../models/document.model.js';
import { statuteEventSchema, type AnalysisEvent, type StatuteEvent } from '../../types/events.js';
import type { VerifiedFinding } from '../../types/finding.js';
import { getRouter } from '../ai/index.js';
import type { Router } from '../ai/router.js';
import type { FileRef } from '../ai/types.js';

import { extract } from './stages/extract.js';
import { classify, ingestFile } from './stages/ingest.js';
import { findStatutes, type StatuteMatch } from './stages/statute.js';
import { anchorQuote, tally, verify } from './stages/verify.js';

/**
 * Hold a statute match to the same standard as a finding.
 *
 * The provision's own words come from the shipped corpus and are not in doubt.
 * What needs checking is the model's claim about WHICH clause triggers it —
 * so that quote goes through the same verifier.
 */
function anchor(hit: StatuteMatch, text: string): StatuteEvent {
  return { ...hit, ...anchorQuote(text, hit.quote) };
}

export type Emit = (event: AnalysisEvent) => void;

export interface AnalyseInput {
  file?: FileRef;
  text?: string;
  jurisdictionState?: string;
  /** When false, nothing about the document is written down (R3.6). */
  store?: boolean;
}

/** SHA-256 of the exact bytes or text. The cache key, and never the content. */
function hashOf(input: AnalyseInput): string {
  const hash = createHash('sha256');
  hash.update(input.file?.bytes ?? input.text ?? '');
  return hash.digest('hex');
}

/**
 * Replay a stored analysis instead of running one.
 *
 * @returns true if a cached result was emitted.
 */
async function replayCached(hash: string, emit: Emit, startedAt: number): Promise<boolean> {
  const document = await documentModel.findByContentHash(hash);
  if (!document) return false;

  const previous = await analysisModel.latestForDocument(document.id);
  if (!previous) return false;

  emit({
    type: 'document',
    documentId: document.id,
    docType: document.docType ?? 'other',
    // Only ever present when the user opted into storage; otherwise the client
    // shows findings without the document pane rather than a blank one.
    text: document.text ?? '',
    cached: true,
  });

  for (const row of previous.findings) {
    emit({
      type: 'finding',
      finding: {
        kind: row.kind,
        severity: row.severity,
        quote: row.quote,
        plainText: row.plainText,
        verified: row.verified,
        charStart: row.charStart,
        charEnd: row.charEnd,
      },
    });
  }

  const statutes = statuteEventSchema.array().safeParse(previous.statutes);
  if (statutes.success) {
    for (const statute of statutes.data) emit({ type: 'statute', statute });
  }

  emit({
    type: 'done',
    verified: previous.verifiedCount,
    rejected: previous.rejectedCount,
    provider: previous.providerUsed,
    statutes: statutes.success ? statutes.data.length : 0,
    degraded: false,
    durationMs: Date.now() - startedAt,
  });
  return true;
}

/**
 * Run an analysis, emitting events as it goes.
 *
 * Streaming rather than returning one lump: on a long contract the difference
 * is a spinner for twenty seconds versus findings appearing from the second or
 * third. Each finding is verified and emitted individually, so what the user
 * sees is already checked against their document.
 *
 * @param input - The document, as bytes or text.
 * @param emit - Sink for events. Called synchronously as work completes.
 * @param router - Provider router; injectable for tests.
 */
export async function analyse(input: AnalyseInput, emit: Emit, router: Router = getRouter()): Promise<void> {
  const startedAt = Date.now();
  const hash = hashOf(input);

  if (await replayCached(hash, emit, startedAt)) return;

  emit({ type: 'stage', stage: 'ingest', status: 'running' });
  const ingested =
    input.file !== undefined
      ? await ingestFile(router, input.file)
      : await classify(router, input.text ?? '');
  emit({ type: 'stage', stage: 'ingest', status: 'done' });

  const document = input.store
    ? await documentModel.create({
        contentHash: hash,
        text: ingested.text,
        docType: ingested.docType,
        stored: true,
        ...(input.jurisdictionState !== undefined ? { jurisdictionState: input.jurisdictionState } : {}),
      })
    : undefined;

  emit({
    type: 'document',
    documentId: document?.id ?? '',
    docType: ingested.docType,
    text: ingested.text,
    cached: false,
  });

  emit({ type: 'stage', stage: 'extract', status: 'running' });
  const { findings, provider, degraded } = await extract(router, ingested.text, ingested.docType);
  emit({ type: 'stage', stage: 'extract', status: 'done' });

  emit({ type: 'stage', stage: 'verify', status: 'running' });
  const verified: VerifiedFinding[] = [];
  for (const finding of verify(ingested.text, findings)) {
    verified.push(finding);
    // Emitted one at a time, rejections included. A tool that hides its own
    // hallucinations is indistinguishable from one that has none.
    emit({ type: 'finding', finding });
  }
  emit({ type: 'stage', stage: 'verify', status: 'done' });

  const counts = tally(verified);

  emit({ type: 'stage', stage: 'statute', status: 'running' });
  const matched = await findStatutes(router, ingested.text, ingested.docType, input.jurisdictionState);
  const statutes = matched.map((hit) => anchor(hit, ingested.text));
  for (const statute of statutes) emit({ type: 'statute', statute });
  emit({ type: 'stage', stage: 'statute', status: 'done' });

  if (document) {
    emit({ type: 'stage', stage: 'persist', status: 'running' });
    await analysisModel.create(
      {
        documentId: document.id,
        providerUsed: provider,
        durationMs: Date.now() - startedAt,
        verifiedCount: counts.verified,
        rejectedCount: counts.rejected,
        statutes,
      },
      verified.map((f) => ({
        kind: f.kind,
        severity: f.severity,
        quote: f.quote,
        charStart: f.charStart,
        charEnd: f.charEnd,
        plainText: f.plainText,
        verified: f.verified,
      })),
    );
    emit({ type: 'stage', stage: 'persist', status: 'done' });
  }

  emit({
    type: 'done',
    verified: counts.verified,
    rejected: counts.rejected,
    provider,
    statutes: statutes.length,
    degraded,
    durationMs: Date.now() - startedAt,
  });
}
