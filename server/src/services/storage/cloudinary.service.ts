import { randomUUID } from 'node:crypto';

import { v2 as cloudinary } from 'cloudinary';

import { getEnv } from '../../config/env.js';
import { logger } from '../../lib/logger.js';

/** How long a generated read URL stays valid. */
const URL_TTL_SECONDS = 15 * 60;

let configured = false;

/**
 * Whether storage is available at all.
 *
 * All three values or none. A half-configured Cloudinary would fail on every
 * upload, and silently running without storage is a supported mode (R3.9).
 */
export function isStorageConfigured(): boolean {
  const env = getEnv();
  return (
    env.CLOUDINARY_CLOUD_NAME !== undefined &&
    env.CLOUDINARY_API_KEY !== undefined &&
    env.CLOUDINARY_API_SECRET !== undefined
  );
}

/**
 * Configure the SDK once, from values already known to be present.
 *
 * Reads them individually rather than passing the env object through, so the
 * types stay non-optional and no `undefined` can reach the SDK.
 */
function configure(): void {
  if (configured) return;
  const env = getEnv();
  const cloudName = env.CLOUDINARY_CLOUD_NAME;
  const apiKey = env.CLOUDINARY_API_KEY;
  const apiSecret = env.CLOUDINARY_API_SECRET;

  if (cloudName === undefined || apiKey === undefined || apiSecret === undefined) {
    throw new Error('Cloudinary is not configured');
  }

  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
  configured = true;
}

/**
 * Store a document.
 *
 * Two things here are not defaults, and both matter.
 *
 * `type: 'authenticated'` rather than Cloudinary's default `'upload'`. The
 * default produces a PUBLIC URL. Putting someone's rent agreement or offer
 * letter on a guessable public address is a real privacy failure, not a
 * theoretical one, and it is the first thing a security review would find.
 *
 * `public_id` is a fresh UUID, never the uploaded filename. Filenames leak
 * employers, landlords, case numbers and people's own names, and we have no
 * use for them.
 *
 * Best-effort by design: a storage failure is logged and swallowed, because an
 * analysis that works is worth more than a copy of the file (R3.9).
 *
 * @param bytes - The file.
 * @param mimeType - Its verified type.
 * @returns The stored id, or undefined if storage was unavailable or failed.
 */
export async function store(bytes: Uint8Array, mimeType: string): Promise<string | undefined> {
  if (!isStorageConfigured()) return undefined;
  configure();

  const publicId = randomUUID();
  const dataUri = `data:${mimeType};base64,${Buffer.from(bytes).toString('base64')}`;

  try {
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: `legal-assist/${getEnv().NODE_ENV}/documents`,
      public_id: publicId,
      type: 'authenticated',
      access_mode: 'authenticated',
      resource_type: 'auto',
      overwrite: false,
    });
    return result.public_id;
  } catch (error) {
    logger.warn({ error, publicId }, 'document storage failed; continuing without it');
    return undefined;
  }
}

/**
 * A short-lived, signed URL for a stored document.
 *
 * Signed and expiring because the asset is `authenticated`: there is no public
 * address to hand out, which is the point.
 *
 * @param publicId - The stored id.
 * @returns A URL valid for fifteen minutes.
 */
export function signedUrl(publicId: string): string {
  configure();
  return cloudinary.url(publicId, {
    type: 'authenticated',
    sign_url: true,
    secure: true,
    expires_at: Math.floor(Date.now() / 1000) + URL_TTL_SECONDS,
  });
}

/**
 * Delete stored documents.
 *
 * Called by the retention job and by "delete my document now". Failures are
 * logged rather than thrown: a purge that stops at the first stubborn asset
 * would leave the rest behind for good.
 *
 * @param publicIds - Ids to remove.
 * @returns How many were deleted.
 */
export async function remove(publicIds: readonly string[]): Promise<number> {
  if (publicIds.length === 0 || !isStorageConfigured()) return 0;
  configure();

  let deleted = 0;
  for (const publicId of publicIds) {
    try {
      await cloudinary.uploader.destroy(publicId, { type: 'authenticated', resource_type: 'image' });
      deleted += 1;
    } catch (error) {
      logger.warn({ error, publicId }, 'could not delete stored document');
    }
  }
  return deleted;
}
