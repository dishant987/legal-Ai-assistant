import type { AppError } from '../lib/errors.js';
import { ValidationError } from '../lib/errors.js';
import type { ApiErrorBody } from '../types/errors.js';
import { messageFor, type Locale } from '../types/messages/index.js';

/**
 * Shape an error for the wire.
 *
 * The single place a non-2xx body is built, and deliberately the only thing
 * that decides what a client is allowed to see. `error.detail` — which may hold
 * a stack, a driver error or a provider's raw response — is never read here
 * (R4.3). The message always comes from the catalogue, never from the
 * exception.
 *
 * @param error - The failure to render.
 * @param requestId - Correlation id, so a user can quote it and we can find the log.
 * @param locale - Language for the message.
 * @returns The uniform error envelope (R4.2).
 */
export function renderError(error: AppError, requestId: string, locale: Locale = 'en'): ApiErrorBody {
  return {
    error: {
      code: error.code,
      message: messageFor(error.code, locale),
      retryable: error.retryable,
      requestId,
      ...(error instanceof ValidationError ? { fields: error.fields } : {}),
    },
  };
}
