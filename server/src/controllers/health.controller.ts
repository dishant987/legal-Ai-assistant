import type { Request, RequestHandler, Response } from 'express';

import * as healthService from '../services/health.service.js';

/** Liveness: the process is up. Deliberately touches nothing else. */
export const live: RequestHandler = (_req: Request, res: Response) => {
  res.json({ status: 'ok', uptimeSeconds: Math.round(process.uptime()) });
};

/** Readiness: the process can actually serve. 503 when the database is unreachable. */
export const ready: RequestHandler = async (_req: Request, res: Response) => {
  const report = await healthService.readiness();
  res.status(report.ready ? 200 : 503).json(report);
};

/** Per-provider health for the live status strip (R2.6). */
export const providers: RequestHandler = async (_req: Request, res: Response) => {
  res.json(await healthService.providerHealth());
};
