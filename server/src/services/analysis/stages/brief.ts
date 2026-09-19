import { briefResultSchema, type BriefResult } from '../../../types/outputs.js';
import { estimateTokens } from '../../ai/limits.js';
import type { Router } from '../../ai/router.js';
import { stagePrompt } from '../prompt.js';

/**
 * Prepare someone for a conversation with a lawyer.
 *
 * The least-crowded bullet in the brief and quietly the most valuable: a first
 * consultation is short and expensive, and it goes very differently when
 * someone arrives with the facts in order and the right questions written down.
 *
 * @param router - The provider router.
 * @param text - The document text.
 * @param docType - What kind of document this is.
 * @param statutes - Provisions the analysis already matched. Nothing else may be cited.
 * @returns Facts, documents to bring, and questions to ask.
 */
export async function buildBrief(
  router: Router,
  text: string,
  docType: string,
  statutes: readonly string[] = [],
): Promise<BriefResult> {
  const prompt = stagePrompt(
    [
      `Someone is taking this ${docType} to a lawyer. Prepare them for that meeting.`,
      '',
      'The questions must come from THIS document — the specific clauses that worry you — not from',
      'a generic list. A good question names a clause. A bad one could be asked about any contract.',
    ],
    briefResultSchema,
    text,
    statutes.length > 0
      ? ['Provisions already identified. Cite these and no others:', ...statutes.map((s) => `  - ${s}`)]
      : ['No provisions were identified. Leave statutesInPlay empty rather than guessing.'],
  );

  const { data } = await router.complete({
    stage: 'brief',
    prompt,
    schema: briefResultSchema,
    temperature: 0.2,
    estimatedTokens: estimateTokens(prompt),
  });

  return data;
}
