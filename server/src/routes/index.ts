import { Router } from 'express';

import * as health from '../controllers/health.controller.js';

/** Wiring only. Every route is versioned under /api/v1 (R1.5). */
export const router: Router = Router();

router.get('/health', health.live);
router.get('/health/ready', health.ready);
router.get('/health/providers', health.providers);
