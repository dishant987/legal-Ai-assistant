import { z } from 'zod';

/**
 * What a finding is.
 *
 * Client-safe: compiled into the browser bundle through the `@api` alias, so it
 * must stay free of Node built-ins and server internals.
 *
 * The `.describe()` text is not documentation for us — it is fed straight into
 * the model as the field description, so the schema doubles as the prompt spec.
 * One definition drives generation, validation and the UI's types at once.
 */
export const findingKinds = ['risk', 'obligation', 'inconsistency', 'unusual', 'missing'] as const;
export const severities = ['critical', 'high', 'medium', 'low', 'info'] as const;

export const findingSchema = z.object({
  kind: z.enum(findingKinds).describe('What sort of issue this is.'),

  severity: z.enum(severities).describe('How much this could cost the reader, in money, time or rights.'),

  quote: z
    .string()
    .min(10)
    .max(2000)
    .describe(
      'Text copied VERBATIM from the document, character for character. Do not paraphrase, ' +
        'correct spelling, or tidy punctuation. If you cannot quote it exactly, do not report it.',
    ),

  plainText: z
    .string()
    .min(10)
    .max(600)
    .describe(
      'What this means for the reader, in plain English a 14-year-old would follow. ' +
        'No legal jargon. Say what could actually happen to them.',
    ),
});

export type Finding = z.infer<typeof findingSchema>;

/** What the extract stage must return. Capped so one bad response cannot flood the UI. */
export const extractResultSchema = z.object({
  findings: z.array(findingSchema).max(40),
});

/**
 * A finding after the verifier has had a go at it.
 *
 * `verified: false` is not hidden. The whole argument of this product is that a
 * claim which cannot be traced to the document gets shown struck through rather
 * than quietly dropped — a tool that silently discards its own hallucinations
 * is indistinguishable from one that has none.
 */
export const verifiedFindingSchema = findingSchema.extend({
  verified: z.boolean(),
  /** Offsets into the ORIGINAL document text, recomputed from the match. */
  charStart: z.number().int().nonnegative(),
  charEnd: z.number().int().nonnegative(),
  rejectedReason: z.string().optional(),
});

export type VerifiedFinding = z.infer<typeof verifiedFindingSchema>;

export const documentTypes = [
  'rent-agreement',
  'employment-offer',
  'freelance-contract',
  'loan-agreement',
  'nda',
  'terms-of-service',
  'legal-notice',
  'other',
] as const;

export const ingestResultSchema = z.object({
  text: z.string().min(1).describe('The full text of the document, transcribed exactly.'),
  docType: z.enum(documentTypes).describe('Best guess at what kind of document this is.'),
  parties: z.array(z.string()).max(6).describe('The roles named in the document, e.g. "landlord", "tenant".'),
});

export type IngestResult = z.infer<typeof ingestResultSchema>;
