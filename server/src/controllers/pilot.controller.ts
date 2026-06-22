import type { NextFunction, Request, Response } from 'express';
import { getPilotStatus } from '../services/pilot.service.js';

export async function getPilotStatusController(_request: Request, response: Response, next: NextFunction) {
  try { response.json({ success: true, pilot: await getPilotStatus() }); } catch (error) { next(error); }
}
