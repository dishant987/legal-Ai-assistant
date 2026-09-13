import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import { getEnv } from '../config/env.js';
import { resolveConnection } from '../lib/dbUrl.js';

/**
 * Run pending migrations.
 *
 * Builds its own connection rather than reusing the application pool: on Neon,
 * DDL must go through the direct (unpooled) endpoint, so DIRECT_DATABASE_URL
 * wins here while the app keeps using the pooled one (R12.3).
 */
async function main(): Promise<void> {
  const env = getEnv();
  const url = env.DIRECT_DATABASE_URL ?? env.DATABASE_URL;
  const { target, ssl } = resolveConnection(url);

  const pool = new pg.Pool({ connectionString: url, ssl, max: 1, connectionTimeoutMillis: 20_000 });

  try {
    console.log(`Migrating ${target} database…`);
    await migrate(drizzle(pool), { migrationsFolder: './db/migrations' });
    console.log('Migrations applied.');
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error('\nMigration failed:\n', error);
  process.exit(1);
});
