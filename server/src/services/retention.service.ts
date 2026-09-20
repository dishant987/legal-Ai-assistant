import { logger } from '../lib/logger.js';
import * as documentModel from '../models/document.model.js';

import { remove } from './storage/cloudinary.service.js';

/** Documents live for a day, then they are gone (R3.5, PRIVACY.md). */
export const RETENTION_HOURS = 24;

const SWEEP_INTERVAL_MS = 60 * 60_000;

/**
 * Delete everything past the retention window.
 *
 * Database rows cascade from the document, so one delete clears the analysis,
 * its findings and its obligations. The stored files do not cascade — they live
 * at Cloudinary — so the ids come back from the delete and are removed
 * separately. Doing it in that order means a crash between the two leaves
 * orphaned files rather than rows pointing at files that are gone.
 *
 * @returns What was removed.
 */
export async function purgeExpired(): Promise<{ documents: number; assets: number }> {
  const assetIds = await documentModel.purgeOlderThan(RETENTION_HOURS);
  const assets = await remove(assetIds);

  if (assetIds.length > 0) logger.info({ assets, documents: assetIds.length }, 'retention sweep');
  return { documents: assetIds.length, assets };
}

/**
 * Run the sweep hourly for as long as the process lives.
 *
 * `unref` so a pending timer never keeps the process alive — without it a
 * container would refuse to exit on SIGTERM and be killed instead.
 *
 * @returns A function that stops the schedule.
 */
export function startRetentionSweep(): () => void {
  const timer = setInterval(() => {
    void purgeExpired().catch((error: unknown) => {
      // Never fatal. The next sweep will pick up whatever this one missed.
      logger.error({ error }, 'retention sweep failed');
    });
  }, SWEEP_INTERVAL_MS);

  timer.unref();
  return () => {
    clearInterval(timer);
  };
}
