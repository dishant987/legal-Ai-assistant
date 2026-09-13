import type { ErrorRequestHandler, RequestHandler } from 'express';

import { toAppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { NotFoundError } from '../lib/errors.js';
import { localeFrom } from '../types/messages/index.js';
import { renderError } from '../views/error.view.js';

/** Anything that reaches here was not a route. */
export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new NotFoundError());
};

/**
 * The only place a non-2xx response is produced.
 *
 * Registered last. Express 5 forwards rejected promises from async handlers
 * automatically, so this catches thrown and rejected errors alike without
 * wrapping every route.
 *
 * A 500 here means an unhandled bug: it is logged at error level with the
 * original value attached, and the client gets a generic code plus the request
 * id. Never a stack, never a driver message (R4.3).
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const error = toAppError(err);
  // Guaranteed: the requestId middleware is registered before anything that
  // can fail, so every request that reaches here already carries one.
  const requestId = req.requestId;

  const entry = { code: error.code, status: error.httpStatus, requestId, detail: error.detail };
  if (error.httpStatus >= 500) logger.error(entry, 'request failed');
  else logger.warn(entry, 'request rejected');

  // A streaming response may already have sent headers; Express must close it.
  if (res.headersSent) {
    res.end();
    return;
  }

  res.status(error.httpStatus).json(renderError(error, requestId, localeFrom(req.get('accept-language'))));
};
