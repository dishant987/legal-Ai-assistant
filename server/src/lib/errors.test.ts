import { describe, expect, it } from 'vitest';

import {
  AllProvidersFailedError,
  AppError,
  DatabaseError,
  NotFoundError,
  ValidationError,
  toAppError,
} from './errors.js';

describe('error hierarchy', () => {
  it('marks transient failures retryable and permanent ones not', () => {
    // The client shows a Retry button off this flag alone, so getting it wrong
    // either hides a recoverable failure or invites a pointless retry.
    expect(new DatabaseError().retryable).toBe(true);
    expect(new AllProvidersFailedError([]).retryable).toBe(true);
    expect(new NotFoundError().retryable).toBe(false);
    expect(new ValidationError({ state: 'required' }).retryable).toBe(false);
  });

  it('maps each error to a sensible status', () => {
    expect(new ValidationError({}).httpStatus).toBe(400);
    expect(new NotFoundError().httpStatus).toBe(404);
    expect(new DatabaseError().httpStatus).toBe(503);
    expect(new AllProvidersFailedError([]).httpStatus).toBe(503);
  });

  it('keeps validation issues addressable per field (R4.8)', () => {
    const error = new ValidationError({ state: 'Pick your state.' });
    expect(error.fields).toEqual({ state: 'Pick your state.' });
  });
});

describe('toAppError', () => {
  it('passes an AppError through unchanged', () => {
    const original = new NotFoundError();
    expect(toAppError(original)).toBe(original);
  });

  it('wraps an unexpected throw as INTERNAL, keeping the original for the log', () => {
    const cause = new Error('password authentication failed');
    const wrapped = toAppError(cause);

    expect(wrapped.code).toBe('INTERNAL');
    expect(wrapped.httpStatus).toBe(500);
    expect(wrapped.retryable).toBe(false);
    // Retained for the log line, never for the response — see error.view.ts.
    expect(wrapped.detail).toBe(cause);
  });

  it('handles a non-Error throw, which a bad library will eventually do', () => {
    expect(toAppError('just a string').code).toBe('INTERNAL');
    expect(toAppError(undefined).code).toBe('INTERNAL');
  });

  it('is an Error, so existing catch blocks and stack traces still work', () => {
    expect(toAppError('x')).toBeInstanceOf(Error);
    expect(new NotFoundError()).toBeInstanceOf(AppError);
  });
});
