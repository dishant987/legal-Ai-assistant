export type DbTarget = 'local' | 'neon';

export interface ConnectionSettings {
  target: DbTarget;
  ssl: { rejectUnauthorized: boolean } | false;
  max: number;
}

/**
 * Derive connection settings from the database URL alone.
 *
 * Local Postgres and Neon differ in exactly one respect that matters: TLS.
 * Neon's pooled endpoint speaks ordinary Postgres wire protocol, so a single
 * driver serves both and switching environments is one env var with no code
 * change anywhere (R12.1, R12.2).
 *
 * Kept free of any config or driver import so it can be tested without a
 * database, an environment, or a connection.
 *
 * @param databaseUrl - A Postgres connection string.
 * @returns Which target it points at and the pool settings it needs.
 * @throws {TypeError} If the string is not a valid URL.
 */
export function resolveConnection(databaseUrl: string): ConnectionSettings {
  const url = new URL(databaseUrl);
  const isNeon = url.hostname.endsWith('.neon.tech');
  const wantsSsl = isNeon || url.searchParams.get('sslmode') === 'require';

  return {
    target: isNeon ? 'neon' : 'local',
    // Neon serves a valid public certificate, so verification stays on.
    // Disabling it would defeat the point of requiring TLS in the first place.
    ssl: wantsSsl ? { rejectUnauthorized: true } : false,
    // Neon's free tier is frugal with connections; local Postgres is not.
    max: isNeon ? 5 : 10,
  };
}
