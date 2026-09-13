import { createApp } from './app.js';
import { getEnv } from './config/env.js';
import { closeDb } from './lib/db.js';
import { logger } from './lib/logger.js';

// Parse configuration before anything else, so a bad value fails here — loudly,
// in one second — instead of surfacing mid-request during a demo.
const env = getEnv();

const server = createApp().listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'server listening');
});

/**
 * Drain rather than drop.
 *
 * Platforms send SIGTERM and then kill the process; without this, in-flight
 * requests are cut off and pooled Postgres connections are left for the server
 * to time out (R8.13).
 */
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'shutting down');
  server.close();
  await closeDb();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'unhandled rejection');
  void shutdown('unhandledRejection');
});

process.on('uncaughtException', (error) => {
  logger.fatal({ error }, 'uncaught exception');
  void shutdown('uncaughtException');
});
