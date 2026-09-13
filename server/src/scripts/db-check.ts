import pg from 'pg';

import { getEnv } from '../config/env.js';
import { resolveConnection } from '../lib/dbUrl.js';

/**
 * Report which database this configuration actually reaches.
 *
 * Exists to make the local/Neon switch verifiable in five seconds: change
 * DATABASE_URL, run this, and watch the target change with no code edit
 * (R12.5).
 */
async function main(): Promise<void> {
  const env = getEnv();
  const { target, ssl, max } = resolveConnection(env.DATABASE_URL);
  const host = new URL(env.DATABASE_URL).hostname;

  console.log(`target   : ${target}`);
  console.log(`host     : ${host}`);
  console.log(`tls      : ${ssl === false ? 'off' : 'on, certificate verified'}`);
  console.log(`pool max : ${String(max)}`);

  const pool = new pg.Pool({
    connectionString: env.DATABASE_URL,
    ssl,
    max: 1,
    connectionTimeoutMillis: 20_000,
  });

  try {
    const started = Date.now();
    const version = await pool.query<{ version: string }>('select version()');
    const applied = await pool.query<{ count: string }>(
      `select count(*)::text as count from information_schema.tables
       where table_schema = 'drizzle' and table_name = '__drizzle_migrations'`,
    );

    console.log(`connected: ${String(Date.now() - started)}ms`);
    console.log(`postgres : ${version.rows[0]?.version.split(' ').slice(0, 2).join(' ') ?? '?'}`);
    console.log(
      applied.rows[0]?.count === '0'
        ? 'migrations: none applied yet — run npm run db:migrate'
        : 'migrations: table present',
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error('\nCould not reach the database:\n', error);
  process.exit(1);
});
