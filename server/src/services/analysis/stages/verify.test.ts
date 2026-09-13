import { describe, expect, it } from 'vitest';

import type { Finding } from '../../../types/finding.js';

import { tally, verify } from './verify.js';

const DOC = [
  '4. SECURITY DEPOSIT',
  'The Tenant shall pay a security deposit equivalent to six (6) months of rent,',
  'refundable without interest within 90 days of vacating the premises.',
  '',
  '9. RESTRAINT',
  'The Employee shall not, for a period of two years after termination, engage in',
  'any business competing with the Company anywhere in India.',
].join('\n');

const finding = (quote: string): Finding => ({
  kind: 'risk',
  severity: 'high',
  quote,
  plainText: 'This clause is worse for you than the market standard.',
});

describe('verify — accepting what is really there', () => {
  it('accepts an exact quote and points at the right words', () => {
    const [result] = verify(DOC, [finding('security deposit equivalent to six (6) months of rent')]);

    expect(result?.verified).toBe(true);
    expect(DOC.slice(result!.charStart, result!.charEnd)).toBe(
      'security deposit equivalent to six (6) months of rent',
    );
  });

  it('recomputes offsets from the match rather than trusting the model', () => {
    // A finding that highlights the wrong sentence is worse than one that
    // highlights nothing, and models are poor at character arithmetic.
    const [result] = verify(DOC, [finding('RESTRAINT')]);
    expect(DOC.slice(result!.charStart, result!.charEnd)).toBe('RESTRAINT');
  });

  it('tolerates a quote spanning a line break, since models re-flow text', () => {
    const [result] = verify(DOC, [
      finding('The Employee shall not, for a period of two years after termination, engage in any business'),
    ]);
    expect(result?.verified).toBe(true);
  });

  it('tolerates collapsed and doubled whitespace', () => {
    const [result] = verify(DOC, [finding('The   Tenant  shall pay a security   deposit')]);
    expect(result?.verified).toBe(true);
  });

  it('tolerates a case change', () => {
    const [result] = verify(DOC, [finding('THE TENANT SHALL PAY A SECURITY DEPOSIT')]);
    expect(result?.verified).toBe(true);
    // The span still points at the document's own casing.
    expect(DOC.slice(result!.charStart, result!.charEnd)).toBe('The Tenant shall pay a security deposit');
  });

  it('tolerates curly quotes and em dashes, which models insert unbidden', () => {
    const source = 'The Landlord’s right of entry — without notice — is absolute.';
    const [result] = verify(source, [
      finding("The Landlord's right of entry - without notice - is absolute."),
    ]);
    expect(result?.verified).toBe(true);
  });

  it('tolerates a non-breaking space', () => {
    const source = 'Payment within 90 days of invoice.';
    const [result] = verify(source, [finding('Payment within 90 days of invoice.')]);
    expect(result?.verified).toBe(true);
  });

  it('takes the first occurrence when a phrase repeats', () => {
    const source = 'the tenant shall pay. later, the tenant shall pay again.';
    const [result] = verify(source, [finding('the tenant shall pay')]);
    expect(result?.charStart).toBe(0);
  });
});

describe('verify — catching what is not', () => {
  it('rejects an invented quote', () => {
    const [result] = verify(DOC, [
      finding('The Tenant may terminate at any time with no penalty whatsoever.'),
    ]);

    expect(result?.verified).toBe(false);
    expect(result?.rejectedReason).toBe('not found in the document');
  });

  it('rejects a quote that is almost right — a plausible hallucination', () => {
    // "twelve" instead of "six". This is the failure mode that matters: not
    // obvious nonsense, but a number quietly changed.
    const [result] = verify(DOC, [finding('security deposit equivalent to twelve (12) months of rent')]);
    expect(result?.verified).toBe(false);
  });

  it('rejects a paraphrase, however faithful', () => {
    const [result] = verify(DOC, [finding('the tenant must pay six months rent as a deposit')]);
    expect(result?.verified).toBe(false);
  });

  it('rejects an empty or whitespace-only quote', () => {
    const results = verify(DOC, [finding(''), finding('   \n  ')]);
    expect(results.every((r) => !r.verified)).toBe(true);
    expect(results[0]?.rejectedReason).toBe('empty quote');
  });

  it('rejects rather than throws when the document itself is empty', () => {
    const [result] = verify('', [finding('anything at all')]);
    expect(result?.verified).toBe(false);
  });

  it('never drops a rejected finding — the UI shows it struck through', () => {
    // A tool that silently discards its own hallucinations is indistinguishable
    // from one that has none. Showing the strike-through is the whole argument.
    const results = verify(DOC, [finding('RESTRAINT'), finding('a clause that does not exist here')]);
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.verified)).toEqual([true, false]);
  });

  it('gives rejected findings zero offsets so nothing highlights', () => {
    const [result] = verify(DOC, [finding('not in the document at all')]);
    expect(result).toMatchObject({ charStart: 0, charEnd: 0 });
  });
});

describe('verify — shape', () => {
  it('preserves every original field', () => {
    const original = finding('RESTRAINT');
    const [result] = verify(DOC, [original]);
    expect(result).toMatchObject({
      kind: original.kind,
      severity: original.severity,
      quote: original.quote,
      plainText: original.plainText,
    });
  });

  it('handles an empty list', () => {
    expect(verify(DOC, [])).toEqual([]);
  });
});

describe('tally', () => {
  it('counts both sides', () => {
    const results = verify(DOC, [finding('RESTRAINT'), finding('SECURITY DEPOSIT'), finding('invented')]);
    expect(tally(results)).toEqual({ verified: 2, rejected: 1 });
  });

  it('handles an empty list', () => {
    expect(tally([])).toEqual({ verified: 0, rejected: 0 });
  });
});
