import { actResultSchema, type ActResult } from '../../../types/outputs.js';
import { estimateTokens } from '../../ai/limits.js';
import type { Router } from '../../ai/router.js';
import { stagePrompt } from '../prompt.js';

/**
 * Turn an analysis into something to do.
 *
 * A summary tells someone their contract is bad. A message they can paste into
 * WhatsApp is what actually changes it — asking for three specific wording
 * changes is a conversation most people can have, where "my contract is unfair"
 * is not.
 *
 * @param router - The provider router.
 * @param text - The document text.
 * @param docType - What kind of document this is.
 * @returns Summary, pre-signing checklist, redlines and a sendable message.
 */
export async function buildActions(router: Router, text: string, docType: string): Promise<ActResult> {
  const prompt = stagePrompt(
    [
      `Someone is about to sign this ${docType}. Give them what they need to act.`,
      '',
      'The message is the important part. Write it as they would: polite, specific, asking for the',
      'two or three changes that matter most. No legal jargon, no threats, no template language.',
      'It should read like a person who has read their contract carefully, not like a lawyer.',
    ],
    actResultSchema,
    text,
  );

  const { data } = await router.complete({
    stage: 'act',
    prompt,
    schema: actResultSchema,
    // Above zero only here: this is the one stage where wording quality matters
    // more than determinism, and everything factual was extracted already.
    temperature: 0.3,
    estimatedTokens: estimateTokens(prompt),
  });

  return data;
}
