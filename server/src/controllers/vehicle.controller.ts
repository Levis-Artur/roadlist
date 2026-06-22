import type { NextFunction, Request, Response } from 'express';
import { createVehicle, deactivateVehicle, listAvailableVehicles, listVehicles, updateVehicle } from '../services/vehicle.service.js';

function metadata(request: Request) {
  return { ipAddress: request.ip, userAgent: request.get('user-agent') };
}

export async function listAvailableVehiclesController(_request: Request, response: Response, next: NextFunction) {
  try { const vehicles = await listAvailableVehicles(); response.json({ success: true, vehicles: Array.isArray(vehicles) ? vehicles : [] }); } catch (error) { next(error); }
}

export async function listVehiclesController(request: Request, response: Response, next: NextFunction) {
  try { const vehicles = await listVehicles(request.query); response.json({ success: true, vehicles: Array.isArray(vehicles) ? vehicles : [] }); } catch (error) { next(error); }
}

export async function createVehicleController(request: Request, response: Response, next: NextFunction) {
  try { response.status(201).json({ success: true, vehicle: await createVehicle(request.body ?? {}, metadata(request)) }); } catch (error) { next(error); }
}

export async function updateVehicleController(request: Request, response: Response, next: NextFunction) {
  try { response.json({ success: true, vehicle: await updateVehicle(request.params.id, request.body ?? {}, metadata(request)) }); } catch (error) { next(error); }
}

export async function deactivateVehicleController(request: Request, response: Response, next: NextFunction) {
  try {
    await deactivateVehicle(request.params.id, metadata(request));
    response.json({ success: true, message: 'Автомобіль деактивовано' });
  } catch (error) { next(error); }
}
