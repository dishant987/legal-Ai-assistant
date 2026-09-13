import { AppError } from '../../../lib/errors.js';
import { ingestResultSchema, type IngestResult } from '../../../types/finding.js';
import { estimateTokens } from '../../ai/limits.js';
import type { Router } from '../../ai/router.js';
import type { FileRef } from '../../ai/types.js';
import { describeSchema, RULES } from '../prompt.js';

/** Types we will attempt to read directly, without a model. */
const PLAIN_TEXT = new Set(['text/plain', 'text/markdown', 'application/json']);

/**
 * Turn whatever was uploaded into text.
 *
 * The interesting case is a photograph of stamp paper: Indian rent agreements
 * are routinely signed on it, photographed on a phone, and part-Devanagari.
 * Rather than an OCR layer — which is exactly where such pipelines break — the
 * file goes straight to a provider that reads documents natively. Not having
 * the OCR step is both simpler and the reason this survives inputs that defeat
 * the usual approach.
 *
 * @param router - The provider router.
 * @param file - The uploaded file.
 * @returns The document text, its type, and the roles it names.
 * @throws {AppError} NO_TEXT_FOUND if nothing readable could be recovered.
 */
export async function ingestFile(router: Router, file: FileRef): Promise<IngestResult> {
  if (PLAIN_TEXT.has(file.mimeType)) {
    const text = new TextDecoder().decode(file.bytes).trim();
    if (text.length === 0) throw new AppError('NO_TEXT_FOUND', 422, false, { mimeType: file.mimeType });
    return classify(router, text);
  }

  const prompt = [
    'Transcribe this document completely and exactly.',
    'Keep the original wording, numbering and clause order. Do not summarise, correct or reorder.',
    'If part of it is in Hindi or another Indian language, transcribe it in its own script.',
    '',
    RULES,
    '',
    'Return JSON matching this schema:',
    describeSchema(ingestResultSchema),
  ].join('\n');

  const { data } = await router.complete({
    stage: 'ingest',
    prompt,
    schema: ingestResultSchema,
    temperature: 0,
    // The document dominates the cost; the prompt is rounding error.
    estimatedTokens: estimateTokens(prompt) + Math.ceil(file.bytes.length / 3),
    file,
  });

  if (data.text.trim().length === 0) {
    throw new AppError('NO_TEXT_FOUND', 422, false, { mimeType: file.mimeType });
  }
  return data;
}

/**
 * Work out what a piece of pasted text is.
 *
 * @param router - The provider router.
 * @param text - Document text supplied directly.
 * @returns The text plus its classification.
 */
export async function classify(router: Router, text: string): Promise<IngestResult> {
  const prompt = [
    'Identify this document. Do not transcribe it — copy the text back unchanged.',
    '',
    RULES,
    '',
    'Return JSON matching this schema:',
    describeSchema(ingestResultSchema),
    '',
    // Only the opening is needed to classify, and sending the whole contract
    // here would double the token cost of every analysis for no benefit.
    text.slice(0, 4000),
  ].join('\n');

  const { data } = await router.complete({
    stage: 'ingest',
    prompt,
    schema: ingestResultSchema,
    temperature: 0,
    estimatedTokens: estimateTokens(prompt),
  });

  // The model was asked to echo the text, but the text we already hold is
  // authoritative — every span offset will be computed against it.
  return { ...data, text };
}
