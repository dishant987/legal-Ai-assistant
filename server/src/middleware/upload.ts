import { fileTypeFromBuffer } from 'file-type';
import multer from 'multer';

import { AppError } from '../lib/errors.js';

/** 10 MB. Large enough for a scanned contract, small enough to fail fast. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** What we can actually read. */
const ALLOWED = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/plain',
  'text/markdown',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

/**
 * Accept one file into memory.
 *
 * Memory storage on purpose: the file never touches the filesystem, so a
 * crafted filename cannot escape a directory, and nothing is left behind if the
 * process dies mid-request (R8.5). The original filename is discarded entirely —
 * it leaks employers, landlords and case numbers, and we have no use for it.
 */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
}).single('file');

/**
 * Confirm a file really is what it claims.
 *
 * The browser-supplied content-type is a hint from an untrusted client, so it
 * is checked against the actual leading bytes. Plain text has no signature, so
 * it is accepted on a successful UTF-8 decode instead.
 *
 * @param bytes - The uploaded bytes.
 * @param declared - The content-type the client claimed.
 * @returns The verified MIME type.
 * @throws {AppError} UNSUPPORTED_TYPE when the real type is not one we read.
 */
export async function verifyFileType(bytes: Uint8Array, declared: string): Promise<string> {
  const sniffed = await fileTypeFromBuffer(bytes);

  if (sniffed === undefined) {
    // No magic bytes: only plausible for text. Decode strictly rather than
    // trusting the declared type.
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      return declared === 'text/markdown' ? 'text/markdown' : 'text/plain';
    } catch {
      throw new AppError('UNSUPPORTED_TYPE', 415, false, { declared, sniffed: 'unknown' });
    }
  }

  if (!ALLOWED.has(sniffed.mime)) {
    throw new AppError('UNSUPPORTED_TYPE', 415, false, { declared, sniffed: sniffed.mime });
  }

  return sniffed.mime;
}
