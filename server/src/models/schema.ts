import { relations } from 'drizzle-orm';
import {
  bigserial,
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * The single source of truth for the database shape.
 *
 * Server-only: this pulls in drizzle-orm/pg-core, so it must never be reachable
 * from the client. The browser-facing contract lives in src/types instead.
 */

export const severityEnum = pgEnum('severity', ['critical', 'high', 'medium', 'low', 'info']);

export const findingKindEnum = pgEnum('finding_kind', [
  'risk',
  'obligation',
  'inconsistency',
  'unusual',
  'missing',
]);

export const providerOutcomeEnum = pgEnum('provider_outcome', [
  'ok',
  'timeout',
  'rate_limited',
  'http_error',
  'parse_error',
  'skipped',
]);

/**
 * An uploaded document.
 *
 * `contentHash` is a SHA-256 of the file bytes and is the cache key: re-uploading
 * the same contract is a database hit, not another round of AI calls (R9.1).
 *
 * `cloudinaryPublicId` is null whenever the user declined storage, which is the
 * default (R3.6). The row itself is purged after 24 hours either way (R3.5).
 */
export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    contentHash: text('content_hash').notNull(),
    docType: text('doc_type'),
    jurisdictionState: text('jurisdiction_state'),
    pageCount: integer('page_count'),
    cloudinaryPublicId: text('cloudinary_public_id'),
    stored: boolean('stored').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('documents_content_hash_idx').on(t.contentHash),
    index('documents_created_at_idx').on(t.createdAt),
  ],
);

/** One analysis run over a document. */
export const analyses = pgTable(
  'analyses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    providerUsed: text('provider_used').notNull(),
    durationMs: integer('duration_ms').notNull(),
    /** How many findings survived the verifier, and how many it struck out (F9). */
    verifiedCount: integer('verified_count').notNull().default(0),
    rejectedCount: integer('rejected_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('analyses_document_id_idx').on(t.documentId)],
);

/**
 * A single finding, anchored to the exact words that produced it (F8).
 *
 * `quote` must appear verbatim in the source document. `verified` records
 * whether the verifier actually found it there — false means the model made it
 * up, and the UI shows it struck through rather than hiding the failure.
 */
export const findings = pgTable(
  'findings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    analysisId: uuid('analysis_id')
      .notNull()
      .references(() => analyses.id, { onDelete: 'cascade' }),
    kind: findingKindEnum('kind').notNull(),
    severity: severityEnum('severity').notNull(),
    quote: text('quote').notNull(),
    charStart: integer('char_start').notNull(),
    charEnd: integer('char_end').notNull(),
    plainText: text('plain_text').notNull(),
    marketNote: text('market_note'),
    statuteRef: text('statute_ref'),
    verified: boolean('verified').notNull().default(false),
  },
  (t) => [index('findings_analysis_id_idx').on(t.analysisId)],
);

/** Who owes what, by when, and what happens if they miss it. */
export const obligations = pgTable(
  'obligations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    analysisId: uuid('analysis_id')
      .notNull()
      .references(() => analyses.id, { onDelete: 'cascade' }),
    party: text('party').notNull(),
    duty: text('duty').notNull(),
    dueBy: text('due_by'),
    consequence: text('consequence'),
  },
  (t) => [index('obligations_analysis_id_idx').on(t.analysisId)],
);

/**
 * Every provider attempt, successful or not. Powers the live health strip and
 * the failover story (R2.5). Deliberately not linked to a document: it is
 * operational telemetry and must outlive the 24-hour document purge.
 */
export const providerEvents = pgTable(
  'provider_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    provider: text('provider').notNull(),
    stage: text('stage').notNull(),
    latencyMs: integer('latency_ms').notNull(),
    outcome: providerOutcomeEnum('outcome').notNull(),
    errorCode: text('error_code'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('provider_events_created_at_idx').on(t.createdAt.desc())],
);

export const documentsRelations = relations(documents, ({ many }) => ({
  analyses: many(analyses),
}));

export const analysesRelations = relations(analyses, ({ one, many }) => ({
  document: one(documents, { fields: [analyses.documentId], references: [documents.id] }),
  findings: many(findings),
  obligations: many(obligations),
}));

export const findingsRelations = relations(findings, ({ one }) => ({
  analysis: one(analyses, { fields: [findings.analysisId], references: [analyses.id] }),
}));

export const obligationsRelations = relations(obligations, ({ one }) => ({
  analysis: one(analyses, { fields: [obligations.analysisId], references: [analyses.id] }),
}));

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type Analysis = typeof analyses.$inferSelect;
export type NewAnalysis = typeof analyses.$inferInsert;
export type Finding = typeof findings.$inferSelect;
export type NewFinding = typeof findings.$inferInsert;
export type Obligation = typeof obligations.$inferSelect;
export type NewObligation = typeof obligations.$inferInsert;
export type NewProviderEvent = typeof providerEvents.$inferInsert;
