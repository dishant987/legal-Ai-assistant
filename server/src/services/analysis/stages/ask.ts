import { askResultSchema, type AskResult } from '../../../types/outputs.js';
import { estimateTokens } from '../../ai/limits.js';
import type { Router } from '../../ai/router.js';
import { stagePrompt } from '../prompt.js';

/**
 * Answer a question strictly from the document.
 *
 * The constraint is the feature. A general-purpose model asked "can my landlord
 * keep my deposit?" answers from what it knows about tenancy in general — which
 * may be true, may be American, and is not about the reader's contract. Here
 * the only admissible source is the page in front of them, and "your document
 * does not say" is a correct and useful answer.
 *
 * @param router - The provider router.
 * @param text - The document text.
 * @param question - What the reader asked.
 * @returns The answer and the text it rests on, or an admission of silence.
 */
export async function askDocument(router: Router, text: string, question: string): Promise<AskResult> {
  const prompt = stagePrompt(
    [
      'Answer the question below using ONLY what this document says.',
      '',
      'If the document does not answer it, set notInDocument to true and say so plainly. Do not fall',
      'back on general knowledge of Indian law, and do not infer what the document probably means.',
      'An honest "it does not say" is more useful than a confident guess.',
    ],
    askResultSchema,
    text,
    [`Question: ${question}`],
  );

  const { data } = await router.complete({
    stage: 'ask',
    prompt,
    schema: askResultSchema,
    temperature: 0,
    estimatedTokens: estimateTokens(prompt),
  });

  return data;
}
