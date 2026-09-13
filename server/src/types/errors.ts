import { z } from 'zod';

/**
 * The API's error vocabulary.
 *
 * Client-safe: this module is imported by the React app through the `@api`
 * alias, so it must stay free of Node built-ins and server-only config.
 *
 * Adding a code here without adding its `en` and `hi` message fails the build —
 * the message catalogue is typed as `Record<ErrorCode, string>` (R4.6).
 */
export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'NOT_FOUND',
  'RATE_LIMITED',
  'FILE_TOO_LARGE',
  'UNSUPPORTED_TYPE',
  'NO_TEXT_FOUND',
  'ALL_PROVIDERS_FAILED',
  'PROVIDER_DEGRADED',
  'STORAGE_FAILED',
  'DATABASE_ERROR',
  'INTERNAL',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const errorCodeSchema = z.enum(ERROR_CODES);

/**
 * The single error envelope every non-2xx response uses (R4.2).
 *
 * `message` is always drawn from the message catalogue — never an exception
 * string, a stack trace, a driver error or a provider's raw output (R4.3).
 */
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES),
    message: z.string().min(1),
    retryable: z.boolean(),
    requestId: z.string().min(1),
    /** Field-level issues, present only for VALIDATION_FAILED (R4.8). */
    fields: z.record(z.string(), z.string()).optional(),
  }),
});

export type ApiErrorBody = z.infer<typeof apiErrorSchema>;
