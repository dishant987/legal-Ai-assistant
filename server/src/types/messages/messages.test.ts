import { describe, expect, it } from 'vitest';

import { ERROR_CODES } from '../errors.js';

import { en } from './en.js';
import { hi } from './hi.js';

import { LOCALES, localeFrom, messageFor, messages } from './index.js';

describe('message catalogue', () => {
  /**
   * R7.6 — this is the test that keeps R4.6 true six commits from now. Adding
   * an error code without writing its messages should fail here, not surface as
   * a blank dialog in front of a user.
   */
  it.each(LOCALES)('has a message for every error code in %s', (locale) => {
    for (const code of ERROR_CODES) {
      expect(messages[locale][code], `${locale} is missing ${code}`).toBeTruthy();
    }
  });

  it('has no untranslated entries — hi must not be a copy of en', () => {
    for (const code of ERROR_CODES) {
      expect(hi[code], `${code} was never translated`).not.toBe(en[code]);
    }
  });

  it('writes Hindi in Devanagari, not transliterated English', () => {
    for (const code of ERROR_CODES) {
      expect(hi[code], `${code} looks transliterated`).toMatch(/[ऀ-ॿ]/);
    }
  });

  it('never leaks a status code or exception name into a user-facing message', () => {
    // "Error 500" and "PayloadTooLargeError" are exactly what R4.7 exists to prevent.
    for (const code of ERROR_CODES) {
      expect(en[code]).not.toMatch(/\b[45]\d\d\b|Error\b|Exception|undefined|null/);
    }
  });

  /**
   * Two codes are informational: the request actually succeeded, using a backup
   * provider or skipping storage. There is genuinely nothing for the reader to
   * do, and inventing a "try again" would be worse than saying so plainly.
   */
  const INFORMATIONAL = new Set(['PROVIDER_DEGRADED', 'STORAGE_FAILED']);

  it('tells the reader what to do next, unless there is nothing to do', () => {
    const actionable = /try again|upload|fix|take another|exporting|opening|resets|moment/i;
    for (const code of ERROR_CODES) {
      if (INFORMATIONAL.has(code)) continue;
      expect(en[code], `${code} has no next step`).toMatch(actionable);
    }
  });

  it('reassures on the informational codes instead of demanding action', () => {
    for (const code of INFORMATIONAL) {
      expect(en[code as keyof typeof en]).toMatch(/complete/i);
    }
  });
});

describe('messageFor', () => {
  it('defaults to English', () => {
    expect(messageFor('NOT_FOUND')).toBe(en.NOT_FOUND);
  });

  it('returns the requested locale', () => {
    expect(messageFor('NOT_FOUND', 'hi')).toBe(hi.NOT_FOUND);
  });
});

describe('localeFrom', () => {
  it.each([
    [undefined, 'en'],
    ['', 'en'],
    ['en-GB,en;q=0.9', 'en'],
    ['hi', 'hi'],
    ['hi-IN,hi;q=0.9,en;q=0.8', 'hi'],
    ['HI-in', 'hi'],
    ['fr-FR', 'en'],
    ['  hi-IN  ', 'hi'],
  ])('maps %s to %s', (header, expected) => {
    expect(localeFrom(header)).toBe(expected);
  });
});
