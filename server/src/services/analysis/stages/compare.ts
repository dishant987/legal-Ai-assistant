import { compareResultSchema, type CompareResult } from '../../../types/outputs.js';
import { estimateTokens } from '../../ai/limits.js';
import type { Router } from '../../ai/router.js';
import { describeSchema, fenceDocument, RULES } from '../prompt.js';

/**
 * Compare two versions of an agreement.
 *
 * Not a textual diff — a textual diff shows that a paragraph moved. What
 * matters is whether the new version is better or worse for the reader, and a
 * single reworded sentence can shift that more than ten formatting changes.
 *
 * @param router - The provider router.
 * @param before - The earlier version.
 * @param after - The version being offered now.
 * @param docType - What kind of document this is.
 * @returns Substantive changes, and which way the balance moved.
 */
export async function compareDocuments(
  router: Router,
  before: string,
  after: string,
  docType: string,
): Promise<CompareResult> {
  const prompt = [
    `Two versions of the same ${docType}. Say what actually changed for the reader.`,
    '',
    'Ignore reformatting, renumbering and rewording that changes nothing. Report only changes that',
    'alter what someone must do, may do, or risks. For each one, say who it favours.',
    '',
    'balanceShift: -100 if every change is against the reader, +100 if every change helps them,',
    '0 if it nets out. Judge by weight, not count — one shifted liability can outweigh five',
    'small improvements.',
    '',
    RULES,
    '',
    'Return JSON matching this schema:',
    describeSchema(compareResultSchema),
    '',
    'VERSION BEFORE:',
    fenceDocument(before),
    '',
    'VERSION AFTER:',
    fenceDocument(after),
  ].join('\n');

  const { data } = await router.complete({
    stage: 'compare',
    prompt,
    schema: compareResultSchema,
    temperature: 0,
    estimatedTokens: estimateTokens(prompt),
  });

  return data;
}
