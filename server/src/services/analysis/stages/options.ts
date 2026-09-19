import { optionsResultSchema, type OptionsResult } from '../../../types/outputs.js';
import { estimateTokens } from '../../ai/limits.js';
import type { Router } from '../../ai/router.js';
import { stagePrompt } from '../prompt.js';

/** The line this product does not cross, appended regardless of what the model returns. */
export const ADVICE_DISCLAIMER =
  'These are options, not a recommendation. This tool gives information, not legal advice, and it ' +
  'cannot know your circumstances. For advice on what you should actually do, speak to a lawyer — ' +
  'free legal aid is available through NALSA on 15100.';

/**
 * What the reader could do next.
 *
 * Deliberately plural and deliberately unranked. A tool that tells someone to
 * sue, settle or sign has crossed from information into advice — which the
 * brief explicitly rules out, and which it could not do responsibly anyway
 * without knowing anything about their circumstances.
 *
 * @param router - The provider router.
 * @param text - The document text.
 * @param docType - What kind of document this is.
 * @param concern - What the reader said worries them, if anything.
 * @returns Options, each with its upside, downside and forum.
 */
export async function findOptions(
  router: Router,
  text: string,
  docType: string,
  concern?: string,
): Promise<OptionsResult> {
  const prompt = stagePrompt(
    [
      `Someone has been given this ${docType} and wants to know what their choices are.`,
      '',
      'Set out the realistic options, each with its upside and its downside, and where it would',
      'happen — the rent authority, the consumer commission, the labour commissioner, a civil court.',
      '',
      'Do NOT recommend one. Do not rank them, do not say which is best, and do not say what they',
      'should do. Lay out the choices and let them decide. If the situation plainly needs a lawyer,',
      'include that as one of the options rather than as advice.',
    ],
    optionsResultSchema,
    text,
    concern !== undefined && concern !== '' ? [`What they are worried about: ${concern}`] : [],
  );

  const { data } = await router.complete({
    stage: 'options',
    prompt,
    schema: optionsResultSchema,
    temperature: 0.2,
    estimatedTokens: estimateTokens(prompt),
  });

  // Never the model's wording. A disclaimer it can rephrase is a disclaimer it
  // can water down.
  return { ...data, disclaimer: ADVICE_DISCLAIMER };
}
