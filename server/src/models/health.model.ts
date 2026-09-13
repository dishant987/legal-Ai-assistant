import { sql } from 'drizzle-orm';

import { getDb } from '../lib/db.js';

/**
 * Round-trip the database.
 *
 * On Neon this doubles as a warm-up: the free tier suspends after about five
 * minutes idle, and the first query afterwards pays a cold start of roughly a
 * second (R12.4). Hitting readiness before a demo is what stops that cold start
 * looking like a bug on stage.
 *
 * @returns How long the round trip took, in milliseconds.
 * @throws If the database is unreachable.
 */
export async function ping(): Promise<number> {
  const started = Date.now();
  await getDb().execute(sql`select 1`);
  return Date.now() - started;
}
