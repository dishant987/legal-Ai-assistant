import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import { getEnv } from '../config/env.js';
import * as schema from '../models/schema.js';

import { resolveConnection, type DbTarget } from './dbUrl.js';

type Db = NodePgDatabase<typeof schema>;

let pool: pg.Pool | undefined;
let db: Db | undefined;
let target: DbTarget | undefined;

function connect(): { pool: pg.Pool; db: Db; target: DbTarget } {
  if (pool === undefined || db === undefined || target === undefined) {
    const url = getEnv().DATABASE_URL;
    const settings = resolveConnection(url);

    pool = new pg.Pool({
      connectionString: url,
      ssl: settings.ssl,
      max: settings.max,
      // Neon's free tier suspends after ~5 minutes idle; the first query after
      // that pays a cold start of roughly a second (R12.4).
      connectionTimeoutMillis: 15_000,
      idleTimeoutMillis: 30_000,
    });

    db = drizzle(pool, { schema });
    target = settings.target;
  }
  return { pool, db, target };
}

/**
 * The Drizzle client, created on first use.
 *
 * Deliberately lazy: importing this module must not open a pool or demand a
 * valid environment, or nothing that touches a model can be unit-tested.
 *
 * @returns The shared Drizzle client.
 */
export function getDb(): Db {
  return connect().db;
}

/** Which database this process is talking to. Reported by `npm run db:check`. */
export function getDbTarget(): DbTarget {
  return connect().target;
}

/** Raw pool, for health checks and shutdown. Models should use {@link getDb}. */
export function getPool(): pg.Pool {
  return connect().pool;
}

/** Close the pool so SIGTERM drains connections instead of dropping them. */
export async function closeDb(): Promise<void> {
  if (pool !== undefined) {
    await pool.end();
    pool = undefined;
    db = undefined;
    target = undefined;
  }
}
