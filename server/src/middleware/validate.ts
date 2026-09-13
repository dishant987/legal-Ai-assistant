import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodType } from 'zod';

import { ValidationError } from '../lib/errors.js';

interface Schemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

/**
 * Validate a request against Zod schemas before a controller sees it.
 *
 * Every route gets one — a route without a validator is a bug (R8.4). Parsed
 * values replace the raw ones, so controllers receive typed, coerced data and
 * unknown keys are stripped rather than carried deeper into the system.
 *
 * Failures come back as field-level issues rather than one opaque string, so
 * the client can attach each message to the input that caused it (R4.8).
 *
 * @param schemas - Schemas for whichever parts of the request are present.
 * @returns Express middleware.
 */
export function validate(schemas: Schemas): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const fields: Record<string, string> = {};

    for (const key of ['body', 'query', 'params'] as const) {
      const schema = schemas[key];
      if (!schema) continue;

      const result = schema.safeParse(req[key]);
      if (result.success) {
        // req.query is a getter in Express 5, so assign through defineProperty.
        Object.defineProperty(req, key, { value: result.data, writable: true, configurable: true });
      } else {
        for (const issue of result.error.issues) {
          const path = issue.path.join('.');
          fields[path === '' ? key : path] ??= issue.message;
        }
      }
    }

    next(Object.keys(fields).length > 0 ? new ValidationError(fields) : undefined);
  };
}
