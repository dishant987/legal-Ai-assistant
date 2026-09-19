import { ERROR_CODES, type ErrorCode } from '@api/errors.js';

/**
 * The only messages written on the client.
 *
 * Everything else comes from the server's catalogue. These three cover the
 * cases where there is no server response to read a message out of.
 */
export const FALLBACKS = {
  OFFLINE:
    "We couldn't reach the server. Check your connection and try again — nothing you typed has been lost.",
  TIMEOUT: 'The server took too long to answer. It may still be working on it; try again in a moment.',
  INTERNAL:
    'Something went wrong and we could not tell what. Try again, and if it keeps happening the reference code will help us find it.',
} as const;

/**
 * Every failure the client can see, in one shape.
 *
 * Components never handle an AxiosError, a TypeError from a dropped connection,
 * or a raw status code — the interceptor converts all of them into this, so
 * there is exactly one thing to render and one flag to decide whether to offer
 * a retry.
 *
 * Fields are declared rather than written as constructor parameter properties,
 * because the client compiles under `erasableSyntaxOnly`.
 */
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly retryable: boolean;
  /** Present whenever the server gave us one; quoting it finds the log line. */
  readonly requestId: string | undefined;
  /** Field-level issues, for validation failures (R4.8). */
  readonly fields: Record<string, string> | undefined;

  constructor(
    code: ErrorCode,
    message: string,
    retryable: boolean,
    requestId?: string,
    fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.retryable = retryable;
    this.requestId = requestId;
    this.fields = fields;
  }

  /** Build from a server error envelope, falling back if it is malformed. */
  static fromEnvelope(body: unknown): ApiError {
    const error = (body as { error?: Record<string, unknown> } | null)?.error;
    const code = error?.code;
    const fields = error?.fields;

    return new ApiError(
      typeof code === 'string' && (ERROR_CODES as readonly string[]).includes(code)
        ? (code as ErrorCode)
        : 'INTERNAL',
      typeof error?.message === 'string' ? error.message : FALLBACKS.INTERNAL,
      error?.retryable === true,
      typeof error?.requestId === 'string' ? error.requestId : undefined,
      typeof fields === 'object' && fields !== null ? (fields as Record<string, string>) : undefined,
    );
  }

  /** The request never reached the server. */
  static network(): ApiError {
    return new ApiError('INTERNAL', FALLBACKS.OFFLINE, true);
  }

  /** The server took too long to answer. */
  static timeout(): ApiError {
    return new ApiError('INTERNAL', FALLBACKS.TIMEOUT, true);
  }
}
