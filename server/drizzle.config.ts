import { config as loadDotenv } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

loadDotenv({ quiet: true });

/**
 * DIRECT_DATABASE_URL first, deliberately.
 *
 * On Neon, migrations must run against the direct (unpooled) endpoint — DDL
 * through the pooler fails or behaves oddly. Locally the variable is absent and
 * this falls through to DATABASE_URL (R12.3).
 */
const url = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set. Copy .env.example to .env first.');

export default defineConfig({
  schema: './src/models/schema.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
