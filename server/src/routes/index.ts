import { Router } from 'express';

import * as analysis from '../controllers/analysis.controller.js';
import * as health from '../controllers/health.controller.js';
import { analyseLimiter, uploadLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { upload } from '../middleware/upload.js';

/** Wiring only. Every route is versioned under /api/v1 (R1.5). */
export const router: Router = Router();

router.get('/health', health.live);
router.get('/health/ready', health.ready);
router.get('/health/providers', health.providers);

// Both limiters apply: uploads touch storage, analysis burns free-tier tokens.
router.post(
  '/analyses',
  uploadLimiter,
  analyseLimiter,
  upload,
  // After multer: with multipart, the body fields do not exist until it runs.
  validate({ body: analysis.analyseBodySchema }),
  analysis.analyseDocument,
);
