import type { Request, RequestHandler, Response } from 'express';
import { z } from 'zod';

import { getRouter } from '../services/ai/index.js';
import { buildActions } from '../services/analysis/stages/act.js';
import { askDocument } from '../services/analysis/stages/ask.js';
import { buildBrief } from '../services/analysis/stages/brief.js';
import { compareDocuments } from '../services/analysis/stages/compare.js';
import { findOptions } from '../services/analysis/stages/options.js';
import { anchorQuote } from '../services/analysis/stages/verify.js';

const documentText = z.string().min(20).max(500_000);

export const followupBodySchema = z.object({
  text: documentText,
  docType: z.string().min(2).max(40).default('other'),
  want: z.enum(['options', 'act', 'brief']),
  /** What the reader said worries them. Only used by `options`. */
  concern: z.string().max(500).optional(),
  /** Provisions already matched. The brief may cite these and nothing else. */
  statutes: z.array(z.string().max(200)).max(8).optional(),
});

export const askBodySchema = z.object({
  text: documentText,
  question: z.string().min(3).max(500),
});

export const compareBodySchema = z.object({
  before: documentText,
  after: documentText,
  docType: z.string().min(2).max(40).default('other'),
});

/**
 * Generate an actionable output on demand.
 *
 * Deliberately not part of the analysis pipeline. Running options, actions and
 * the lawyer brief on every upload would triple the model calls per document,
 * and most readers want one of the three — on a free tier that is the
 * difference between a working demo and an exhausted quota.
 */
export const followup: RequestHandler = async (req: Request, res: Response) => {
  const body = req.body as z.infer<typeof followupBodySchema>;
  const router = getRouter();

  switch (body.want) {
    case 'options':
      res.json(await findOptions(router, body.text, body.docType, body.concern));
      return;
    case 'brief':
      res.json(await buildBrief(router, body.text, body.docType, body.statutes ?? []));
      return;
    case 'act':
      res.json(await buildActions(router, body.text, body.docType));
      return;
  }
};

/**
 * Answer a question about the document, and anchor the answer to it.
 *
 * The quote goes through the same verifier as everything else, so an answer
 * resting on text that is not in the document is marked unverified rather than
 * presented as fact.
 */
export const ask: RequestHandler = async (req: Request, res: Response) => {
  const body = req.body as z.infer<typeof askBodySchema>;
  const result = await askDocument(getRouter(), body.text, body.question);

  res.json({
    ...result,
    ...(result.notInDocument
      ? { verified: false, charStart: 0, charEnd: 0 }
      : anchorQuote(body.text, result.quote)),
  });
};

/** Compare two versions of an agreement. */
export const compare: RequestHandler = async (req: Request, res: Response) => {
  const body = req.body as z.infer<typeof compareBodySchema>;
  res.json(await compareDocuments(getRouter(), body.before, body.after, body.docType));
};
