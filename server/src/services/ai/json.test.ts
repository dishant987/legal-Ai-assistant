import { describe, expect, it } from 'vitest';

import { parseJsonResponse } from './json.js';

describe('parseJsonResponse', () => {
  it('parses clean JSON', () => {
    expect(parseJsonResponse('{"answer":"yes"}')).toEqual({ answer: 'yes' });
  });

  it('parses an array', () => {
    expect(parseJsonResponse('[1,2,3]')).toEqual([1, 2, 3]);
  });

  it('strips a markdown fence, which models add despite being told not to', () => {
    expect(parseJsonResponse('```json\n{"answer":"yes"}\n```')).toEqual({ answer: 'yes' });
    expect(parseJsonResponse('```\n{"answer":"yes"}\n```')).toEqual({ answer: 'yes' });
  });

  it('ignores prose wrapped around the object', () => {
    // Small and local models do this constantly — which is exactly where the
    // failover chain ends up when the cloud providers are down.
    const reply = 'Sure! Here is the analysis:\n{"answer":"yes"}\nHope that helps.';
    expect(parseJsonResponse(reply)).toEqual({ answer: 'yes' });
  });

  it('handles leading and trailing whitespace', () => {
    expect(parseJsonResponse('\n\n  {"answer":"yes"}  \n')).toEqual({ answer: 'yes' });
  });

  it('keeps nested braces intact', () => {
    const nested = 'Result: {"a":{"b":[{"c":1}]}} done';
    expect(parseJsonResponse(nested)).toEqual({ a: { b: [{ c: 1 }] } });
  });

  it('returns undefined rather than throwing, so the router can retry', () => {
    // The router treats undefined as a parse_error, which earns one retry on
    // the same provider. Throwing here would classify as an http_error instead
    // and skip that retry.
    expect(parseJsonResponse('not json at all')).toBeUndefined();
    expect(parseJsonResponse('')).toBeUndefined();
    expect(parseJsonResponse('   ')).toBeUndefined();
    expect(parseJsonResponse(null)).toBeUndefined();
    expect(parseJsonResponse(undefined)).toBeUndefined();
  });

  it('returns undefined for a truncated object', () => {
    expect(parseJsonResponse('{"answer": "yes"')).toBeUndefined();
  });

  it('does not mistake a lone brace for an object', () => {
    expect(parseJsonResponse('}{')).toBeUndefined();
  });
});
