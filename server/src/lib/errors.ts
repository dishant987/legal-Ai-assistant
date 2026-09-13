import type { ErrorCode } from '../types/errors.js';

/**
 * Every failure the API can express.
 *
 * `detail` is for the log only. It may hold a driver error, a stack, or a
 * provider's raw response — none of which may ever be serialised to a client
 * (R4.3). The error handler is the only thing that reads it, and only to log it.
 */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly httpStatus: number,
    readonly retryable: boolean,
    readonly detail?: unknown,
  ) {
    super(code);
    this.name = 'AppError';
  }
}

/** A request body, query or param that failed its Zod schema. */
export class ValidationError extends AppError {
  constructor(readonly fields: Record<string, string>) {
    super('VALIDATION_FAILED', 400, false, fields);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(detail?: unknown) {
    super('NOT_FOUND', 404, false, detail);
    this.name = 'NotFoundError';
  }
}

export class DatabaseError extends AppError {
  constructor(detail?: unknown) {
    super('DATABASE_ERROR', 503, true, detail);
    this.name = 'DatabaseError';
  }
}

/**
 * Every provider in the chain failed or was skipped.
 *
 * Retryable on purpose: providers come back, and the router picks whichever
 * recovers first, so "try again in a minute" is honest advice (R2.3).
 */
export class AllProvidersFailedError extends AppError {
  constructor(readonly attempts: readonly unknown[]) {
    super('ALL_PROVIDERS_FAILED', 503, true, attempts);
    this.name = 'AllProvidersFailedError';
  }
}

/**
 * Narrow an unknown thrown value to an AppError.
 *
 * Anything that isn't one is an unhandled bug, so it becomes INTERNAL with the
 * original kept as `detail` for the log.
 *
 * @param error - The thrown value.
 * @returns An AppError, always.
 */
export function toAppError(error: unknown): AppError {
  return error instanceof AppError ? error : new AppError('INTERNAL', 500, false, error);
}
