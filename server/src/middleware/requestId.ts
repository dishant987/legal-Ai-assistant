import { randomUUID } from 'node:crypto';

import type { NextFunction, Request, Response } from 'express';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Correlates this request's log lines with the id shown to the user. */
      requestId: string;
    }
  }
}

/**
 * Give every request a traceable id.
 *
 * It goes into each log line, into the error envelope (R4.5), and back in a
 * response header — so a user quoting a reference code from a failure screen is
 * enough to find the exact log entry.
 *
 * An inbound `X-Request-Id` is honoured so a trace survives across hops, but
 * only when it looks sane: it is echoed back to the client, and accepting
 * arbitrary caller input would let someone inject newlines or megabytes into
 * our logs and headers.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const supplied = req.get('x-request-id');
  const id = supplied !== undefined && /^[A-Za-z0-9_-]{8,64}$/.test(supplied) ? supplied : randomUUID();

  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}
