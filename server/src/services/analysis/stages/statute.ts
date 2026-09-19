import { z } from 'zod';

import type { StatuteHit } from '../../../types/statute.js';
import { estimateTokens } from '../../ai/limits.js';
import type { Router } from '../../ai/router.js';
import { matchStatutes, selectableFor } from '../../statutes/matcher.js';
import { describeSchema, fenceDocument, RULES } from '../prompt.js';

/**
 * What the model is allowed to return.
 *
 * An id from the shipped corpus and a quote from the document — nothing else.
 * It never writes an Act name, a section number, or the words of a provision,
 * so a fabricated citation has no route to the reader (F12).
 */
const selectionSchema = z.object({
  selections: z
    .array(
      z.object({
        id: z.string().describe('The exact id from the list of provisions above. Nothing else.'),
        quote: z
          .string()
          .min(10)
          .max(1000)
          .describe('The clause this bears on, copied VERBATIM from the document.'),
      }),
    )
    .max(12),
});

export interface StatuteMatch extends StatuteHit {
  /** The clause the model says this bears on, as it claimed it. */
  quote: string;
}

/**
 * Work out which shipped provisions bear on this document.
 *
 * The model's only job is selection. Deterministic rules run regardless, and
 * anything the model proposes is admitted only if the id is real and relevant
 * to this kind of document.
 *
 * @param router - The provider router.
 * @param text - The document text.
 * @param docType - What kind of document this is.
 * @param state - The reader's state, for jurisdiction honesty (F11).
 * @returns Matched provisions, each tied to the clause it bears on.
 */
export async function findStatutes(
  router: Router,
  text: string,
  docType: string,
  state?: string,
): Promise<StatuteMatch[]> {
  const options = selectableFor(docType);

  // Nothing we ship covers this kind of document, so there is nothing to ask.
  // The deterministic rules still run below.
  const proposed: { id: string; quote: string }[] = [];

  if (options.length > 0) {
    const prompt = [
      `Below is an Indian ${docType}. Decide which of these provisions it runs into.`,
      '',
      'Provisions you may choose from — use the id exactly as written:',
      ...options.map((o) => `  ${o.id}: ${o.trigger}`),
      '',
      'Choose only where the document genuinely triggers the provision. Choosing nothing is a',
      'correct answer for a fair contract. Never invent an id that is not listed above.',
      '',
      RULES,
      '',
      'Return JSON matching this schema:',
      describeSchema(selectionSchema),
      '',
      fenceDocument(text),
    ].join('\n');

    const { data } = await router.complete({
      stage: 'statute',
      prompt,
      schema: selectionSchema,
      temperature: 0,
      estimatedTokens: estimateTokens(prompt),
    });

    proposed.push(...data.selections);
  }

  const quoteById = new Map(proposed.map((s) => [s.id, s.quote]));

  return matchStatutes({
    docType,
    text,
    ...(state !== undefined ? { state } : {}),
    proposedIds: proposed.map((s) => s.id),
  }).map((hit) => ({ ...hit, quote: quoteById.get(hit.statuteId) ?? '' }));
}
