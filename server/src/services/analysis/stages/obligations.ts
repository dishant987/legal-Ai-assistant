import { obligationsResultSchema, type Obligation } from '../../../types/outputs.js';
import { estimateTokens } from '../../ai/limits.js';
import type { Router } from '../../ai/router.js';
import { stagePrompt } from '../prompt.js';

/**
 * Who owes what, by when, and what happens if they miss it.
 *
 * Kept separate from findings because an obligation is not necessarily a
 * problem — it is the work the contract creates, and people routinely sign
 * without ever seeing it laid out in one list.
 *
 * @param router - The provider router.
 * @param text - The document text.
 * @param docType - What kind of document this is.
 * @returns Obligations as the model reported them, unverified.
 */
export async function findObligations(router: Router, text: string, docType: string): Promise<Obligation[]> {
  const prompt = stagePrompt(
    [
      `List every obligation this ${docType} creates, for BOTH sides.`,
      'Include the ones that look routine. Order by who is more exposed if they are missed.',
    ],
    obligationsResultSchema,
    text,
  );

  const { data } = await router.complete({
    stage: 'obligations',
    prompt,
    schema: obligationsResultSchema,
    temperature: 0,
    estimatedTokens: estimateTokens(prompt),
  });

  return data.obligations;
}
