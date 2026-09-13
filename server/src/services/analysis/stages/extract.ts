import { extractResultSchema, type Finding } from '../../../types/finding.js';
import { estimateTokens } from '../../ai/limits.js';
import type { Router } from '../../ai/router.js';
import { describeSchema, fenceDocument, RULES } from '../prompt.js';

/**
 * Find everything in the document that could cost the reader.
 *
 * Temperature zero: this stage reports what is on the page. Creativity here
 * would be invention, and invention is what the verifier exists to catch.
 *
 * @param router - The provider router.
 * @param text - The document text.
 * @param docType - What kind of document this is, for context.
 * @returns Findings as the model reported them, unverified.
 */
export async function extract(
  router: Router,
  text: string,
  docType: string,
): Promise<{ findings: Finding[]; provider: string; degraded: boolean }> {
  const prompt = [
    `You are reviewing an Indian ${docType} on behalf of the weaker party — the one`,
    'signing rather than the one who drafted it.',
    '',
    'Report every clause that could cost them money, time or rights: unusual terms,',
    'obligations with teeth, internal contradictions, and anything conspicuously missing.',
    'Order by severity, worst first. At most 40 findings.',
    '',
    RULES,
    '',
    'Return JSON matching this schema:',
    describeSchema(extractResultSchema),
    '',
    fenceDocument(text),
  ].join('\n');

  const { data, provider, degraded } = await router.complete({
    stage: 'extract',
    prompt,
    schema: extractResultSchema,
    temperature: 0,
    estimatedTokens: estimateTokens(prompt),
  });

  return { findings: data.findings, provider, degraded };
}
