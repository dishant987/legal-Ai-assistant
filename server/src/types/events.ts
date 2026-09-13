import { z } from 'zod';

import { errorCodeSchema } from './errors.js';
import { verifiedFindingSchema } from './finding.js';

/**
 * The server-sent events an analysis emits.
 *
 * Streamed rather than returned in one lump so findings appear as they are
 * verified. On a long contract the difference is a spinner for twenty seconds
 * versus results arriving from the second or third.
 *
 * Client-safe: the browser parses these, so the shapes live here and both sides
 * compile the same definitions.
 */
export const stageNames = ['ingest', 'extract', 'verify', 'persist'] as const;
export type StageName = (typeof stageNames)[number];

export const analysisEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('stage'),
    stage: z.enum(stageNames),
    status: z.enum(['running', 'done']),
  }),

  /** One verified finding. Rejected ones are sent too, flagged, never hidden. */
  z.object({
    type: z.literal('finding'),
    finding: verifiedFindingSchema,
  }),

  z.object({
    type: z.literal('document'),
    documentId: z.string(),
    docType: z.string(),
    /** Full text, so the client can highlight the spans the findings point at. */
    text: z.string(),
    cached: z.boolean(),
  }),

  z.object({
    type: z.literal('done'),
    verified: z.number().int().nonnegative(),
    rejected: z.number().int().nonnegative(),
    provider: z.string(),
    /** True when a fallback provider served this — the UI says so (R2.11). */
    degraded: z.boolean(),
    durationMs: z.number().int().nonnegative(),
  }),

  z.object({
    type: z.literal('error'),
    code: errorCodeSchema,
    message: z.string(),
    retryable: z.boolean(),
    requestId: z.string(),
  }),
]);

export type AnalysisEvent = z.infer<typeof analysisEventSchema>;
