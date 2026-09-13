import { describe, expect, it } from 'vitest';

import { ERROR_CODES, apiErrorSchema } from './errors.js';

const valid = {
  error: {
    code: 'ALL_PROVIDERS_FAILED',
    message: 'All four AI services are unreachable right now. Your document is safe.',
    retryable: true,
    requestId: '0f8a1c7e-2b44-4d1a-9c33-8e5b6a2f1d90',
  },
};

describe('ERROR_CODES', () => {
  it('has no duplicates', () => {
    expect(new Set(ERROR_CODES).size).toBe(ERROR_CODES.length);
  });

  it('is screaming snake case throughout, so codes stay greppable', () => {
    for (const code of ERROR_CODES) expect(code).toMatch(/^[A-Z][A-Z_]*$/);
  });
});

describe('apiErrorSchema', () => {
  it('accepts the standard envelope', () => {
    expect(apiErrorSchema.parse(valid)).toEqual(valid);
  });

  it('accepts field-level issues for validation failures (R4.8)', () => {
    const withFields = {
      error: { ...valid.error, code: 'VALIDATION_FAILED', fields: { state: 'Pick your state.' } },
    };
    expect(apiErrorSchema.parse(withFields).error.fields).toEqual({ state: 'Pick your state.' });
  });

  it('rejects a code outside the vocabulary', () => {
    expect(() => apiErrorSchema.parse({ error: { ...valid.error, code: 'KABOOM' } })).toThrow();
  });

  it('requires a requestId — every error must be traceable to a log line (R4.5)', () => {
    const { requestId: _omitted, ...rest } = valid.error;
    expect(() => apiErrorSchema.parse({ error: rest })).toThrow();
  });

  it('requires a non-empty message, so no error can surface blank', () => {
    expect(() => apiErrorSchema.parse({ error: { ...valid.error, message: '' } })).toThrow();
  });

  it('requires retryable, so the client always knows whether to offer Retry', () => {
    const { retryable: _omitted, ...rest } = valid.error;
    expect(() => apiErrorSchema.parse({ error: rest })).toThrow();
  });
});
