import { Router } from 'express';
import {
  createVehicleController,
  deactivateVehicleController,
  listAvailableVehiclesController,
  listVehiclesController,
  updateVehicleController,
} from '../controllers/vehicle.controller.js';

export const vehicleRouter = Router();
vehicleRouter.get('/available', listAvailableVehiclesController);
vehicleRouter.get('/', listVehiclesController);
vehicleRouter.post('/', createVehicleController);
vehicleRouter.patch('/:id', updateVehicleController);
vehicleRouter.delete('/:id', deactivateVehicleController);
