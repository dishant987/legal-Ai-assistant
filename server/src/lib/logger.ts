import { pino } from 'pino';

import { getEnv } from '../config/env.js';

/**
 * Structured logger.
 *
 * The redaction list is the point (R8.9). People upload rent agreements,
 * employment contracts and legal notices; the contents of those documents must
 * never reach a log file, an aggregator, or a terminal someone screenshots.
 *
 * Redacting at the logger means a careless `log.info({ finding })` somewhere in
 * the pipeline cannot leak a clause, rather than relying on every call site to
 * remember.
 */
export const logger = pino({
  level: getEnv().LOG_LEVEL,
  redact: {
    paths: [
      // Credentials
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.apiKey',
      '*.api_key',
      '*.password',
      'DATABASE_URL',
      // Document content — the whole reason this list exists
      '*.text',
      '*.quote',
      '*.plainText',
      '*.documentText',
      '*.sourceText',
      'text',
      'quote',
    ],
    censor: '[redacted]',
  },
  ...(getEnv().NODE_ENV === 'development'
    ? { transport: { target: 'pino-pretty', options: { colorize: true, singleLine: true } } }
    : {}),
});
