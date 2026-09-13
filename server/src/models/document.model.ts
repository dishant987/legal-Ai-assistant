import { eq, lt, sql } from 'drizzle-orm';

import { getDb } from '../lib/db.js';

import { documents, type Document, type NewDocument } from './schema.js';

/**
 * Look a document up by its content hash.
 *
 * This is the analysis cache (R9.1): the same contract uploaded twice is a
 * single indexed lookup instead of another round of AI calls.
 *
 * @param contentHash - SHA-256 of the file bytes.
 * @returns The document, or undefined if it has not been seen.
 */
export async function findByContentHash(contentHash: string): Promise<Document | undefined> {
  return getDb().query.documents.findFirst({ where: eq(documents.contentHash, contentHash) });
}

/**
 * Insert a document.
 *
 * @param doc - The row to insert.
 * @returns The inserted document, including its generated id.
 * @throws If a document with the same content hash already exists.
 */
export async function create(doc: NewDocument): Promise<Document> {
  const [row] = await getDb().insert(documents).values(doc).returning();
  if (!row) throw new Error('Insert returned no row');
  return row;
}

/**
 * Delete documents older than the retention window.
 *
 * Analyses, findings and obligations cascade away with the document, so this is
 * the whole purge (R3.5). The returned Cloudinary ids are the assets the caller
 * still has to delete remotely.
 *
 * @param hours - Retention window in hours.
 * @returns The Cloudinary public ids belonging to the deleted rows.
 */
export async function purgeOlderThan(hours: number): Promise<string[]> {
  const deleted = await getDb()
    .delete(documents)
    .where(lt(documents.createdAt, sql`now() - make_interval(hours => ${hours})`))
    .returning({ cloudinaryPublicId: documents.cloudinaryPublicId });

  return deleted
    .map((row) => row.cloudinaryPublicId)
    .filter((id): id is string => id !== null && id.length > 0);
}

/**
 * Delete one document immediately, for the "delete my document now" button.
 *
 * @param id - The document id.
 * @returns The Cloudinary public id to remove remotely, if the document had one.
 */
export async function remove(id: string): Promise<string | null> {
  const [row] = await getDb()
    .delete(documents)
    .where(eq(documents.id, id))
    .returning({ cloudinaryPublicId: documents.cloudinaryPublicId });

  return row?.cloudinaryPublicId ?? null;
}
