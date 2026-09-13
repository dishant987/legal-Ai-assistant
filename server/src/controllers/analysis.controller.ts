import type { Request, RequestHandler, Response } from 'express';
import { z } from 'zod';

import { AppError, toAppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { MAX_UPLOAD_BYTES, verifyFileType } from '../middleware/upload.js';
import { analyse } from '../services/analysis/pipeline.js';
import type { AnalysisEvent } from '../types/events.js';
import { localeFrom, messageFor } from '../types/messages/index.js';

export const analyseBodySchema = z.object({
  text: z.string().min(20).max(500_000).optional(),
  jurisdictionState: z.string().min(2).max(60).optional(),
  /**
   * Storage is opt-in, and off unless asked for (R3.6). Legal documents
   * deserve the safe default, even though it costs us the cache.
   */
  store: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((v) => v === true || v === 'true'),
});

/** Write one server-sent event. */
function send(res: Response, event: AnalysisEvent): void {
  res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
}

/**
 * Analyse a document, streaming results as they are produced.
 *
 * Server-sent events rather than a single JSON response: findings are verified
 * and emitted one at a time, so the first ones appear while the rest are still
 * being checked.
 *
 * Errors after the stream opens cannot use the normal error middleware — the
 * status line is long gone — so they are delivered as a final `error` event
 * carrying the same code, message and request id the envelope would have had.
 */
export const analyseDocument: RequestHandler = async (req: Request, res: Response) => {
  // Already validated by the route's validate() middleware (R8.4).
  const body = req.body as z.infer<typeof analyseBodySchema>;
  const uploaded = req.file;

  if (uploaded === undefined && body.text === undefined) {
    throw new AppError('VALIDATION_FAILED', 400, false, 'no file and no text');
  }

  const file =
    uploaded !== undefined
      ? {
          bytes: new Uint8Array(uploaded.buffer),
          mimeType: await verifyFileType(new Uint8Array(uploaded.buffer), uploaded.mimetype),
        }
      : undefined;

  res.status(200).set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // Proxies that buffer would defeat the point of streaming at all.
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  // If the reader navigates away mid-analysis, stop writing into a dead socket.
  // Held in an object, not a `let`: TypeScript narrows a boolean local to
  // always-true because it cannot see the close handler mutate it later.
  const stream = { open: true };
  req.on('close', () => {
    stream.open = false;
  });

  try {
    await analyse(
      {
        ...(file !== undefined ? { file } : {}),
        ...(body.text !== undefined ? { text: body.text } : {}),
        ...(body.jurisdictionState !== undefined ? { jurisdictionState: body.jurisdictionState } : {}),
        store: body.store,
      },
      (event) => {
        if (stream.open) send(res, event);
      },
    );
  } catch (error) {
    const appError = toAppError(error);
    logger.error(
      { code: appError.code, detail: appError.detail, requestId: req.requestId },
      'analysis failed',
    );
    if (stream.open) {
      send(res, {
        type: 'error',
        code: appError.code,
        message: messageFor(appError.code, localeFrom(req.get('accept-language'))),
        retryable: appError.retryable,
        requestId: req.requestId,
      });
    }
  } finally {
    res.end();
  }
};

export const uploadLimits = { maxBytes: MAX_UPLOAD_BYTES };
