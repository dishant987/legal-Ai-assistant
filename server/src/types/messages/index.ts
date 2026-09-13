import type { ErrorCode } from '../errors.js';

import { en } from './en.js';
import { hi } from './hi.js';

export const LOCALES = ['en', 'hi'] as const;
export type Locale = (typeof LOCALES)[number];

export const messages: Record<Locale, Record<ErrorCode, string>> = { en, hi };

/**
 * The human sentence for an error code.
 *
 * The only way an error message reaches a user. Exception text, driver errors
 * and provider output never do (R4.3).
 *
 * @param code - The error code.
 * @param locale - Preferred language; falls back to English.
 * @returns A plain-language message.
 */
export function messageFor(code: ErrorCode, locale: Locale = 'en'): string {
  return messages[locale][code];
}

/**
 * Pick a supported locale from an `Accept-Language` header.
 *
 * Deliberately crude — we support two languages, so full RFC 4647 negotiation
 * would be more code than it is worth.
 *
 * @param header - Raw `Accept-Language` value, if any.
 * @returns A supported locale, defaulting to English.
 */
export function localeFrom(header: string | undefined): Locale {
  if (header === undefined) return 'en';
  const preferred = header.split(',')[0]?.trim().toLowerCase() ?? '';
  return preferred.startsWith('hi') ? 'hi' : 'en';
}

export { en, hi };
