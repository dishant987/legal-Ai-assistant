import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';

import { AppError } from '../lib/errors.js';

/**
 * Build a limiter that fails through the normal error pipeline.
 *
 * express-rate-limit would otherwise send its own plain-text body, which would
 * be the one response in the API that doesn't match the error envelope and
 * carries no translated message (R4.2).
 *
 * @param windowMs - Window length.
 * @param limit - Requests allowed per window.
 */
function limiter(windowMs: number, limit: number): RateLimitRequestHandler {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(new AppError('RATE_LIMITED', 429, true, { windowMs, limit }));
    },
  });
}

/** Broad protection against abuse (R8.3). */
export const globalLimiter = limiter(15 * 60_000, 100);

/**
 * Analysis is the expensive path.
 *
 * This is a cost control as much as an abuse control: every free-tier token a
 * retry loop burns is one a real user cannot spend.
 */
export const analyseLimiter = limiter(60 * 60_000, 10);

/** Uploads are cheaper than analysis but still touch storage. */
export const uploadLimiter = limiter(60 * 60_000, 20);
