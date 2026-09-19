import { desc, eq } from 'drizzle-orm';

import { getDb } from '../lib/db.js';

import {
  analyses,
  findings,
  obligations,
  type Analysis,
  type Finding,
  type NewAnalysis,
  type NewFinding,
  type NewObligation,
  type Obligation,
} from './schema.js';

export type AnalysisWithFindings = Analysis & { findings: Finding[]; obligations: Obligation[] };

/**
 * Store an analysis and its findings together.
 *
 * One transaction: a run that recorded its summary counts but lost its findings
 * would look successful and serve an empty result from cache forever after.
 *
 * @param analysis - The run summary.
 * @param rows - Findings to store alongside it.
 * @returns The stored analysis.
 */
export async function create(
  analysis: NewAnalysis,
  rows: readonly Omit<NewFinding, 'analysisId'>[],
  duties: readonly Omit<NewObligation, 'analysisId'>[] = [],
): Promise<Analysis> {
  return getDb().transaction(async (tx) => {
    const [row] = await tx.insert(analyses).values(analysis).returning();
    if (!row) throw new Error('Insert returned no row');

    if (rows.length > 0) {
      await tx.insert(findings).values(rows.map((f) => ({ ...f, analysisId: row.id })));
    }
    if (duties.length > 0) {
      await tx.insert(obligations).values(duties.map((o) => ({ ...o, analysisId: row.id })));
    }
    return row;
  });
}

/**
 * The most recent analysis of a document, with its findings.
 *
 * This is the cache read (R9.1): re-uploading the same contract replays a
 * stored result instead of spending another round of AI calls.
 *
 * @param documentId - The document to look up.
 * @returns The latest analysis and its findings, or undefined.
 */
export async function latestForDocument(documentId: string): Promise<AnalysisWithFindings | undefined> {
  return getDb().query.analyses.findFirst({
    where: eq(analyses.documentId, documentId),
    orderBy: desc(analyses.createdAt),
    with: { findings: true, obligations: true },
  });
}
