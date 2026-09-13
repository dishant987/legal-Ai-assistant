import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';

import { getEnv } from './config/env.js';
import { logger } from './lib/logger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { globalLimiter } from './middleware/rateLimit.js';
import { requestId } from './middleware/requestId.js';
import { router } from './routes/index.js';

/**
 * Build the Express app.
 *
 * A factory rather than a module-level singleton so tests can construct an app
 * without starting a server or binding a port.
 *
 * @returns A configured Express application.
 */
export function createApp(): Express {
  const env = getEnv();
  const app = express();

  // Rate limiting and logging need the real client IP behind a proxy. One hop
  // only: trusting every hop lets a caller spoof X-Forwarded-For and walk
  // straight past the limiter.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // First, before anything that can fail: a request rejected by helmet or CORS
  // still needs an id on its log line and in its error envelope.
  app.use(requestId);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          // Fonts are self-hosted npm packages, so no font or style CDN is
          // allowed here. A Google Fonts link would need one (R8.1).
          styleSrc: ["'self'"],
          fontSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com'],
          connectSrc: ["'self'", 'https://res.cloudinary.com'],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );

  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
      credentials: false,
    }),
  );

  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as { requestId?: string }).requestId ?? '',
    }),
  );

  // 100 kB is generous for our JSON: documents arrive as multipart, not in a
  // body. A smaller cap means a malformed upload fails fast and cheaply.
  app.use(express.json({ limit: '100kb' }));
  app.use(globalLimiter);

  app.use('/api/v1', router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
