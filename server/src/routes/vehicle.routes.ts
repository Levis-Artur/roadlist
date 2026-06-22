import { Router } from 'express';
import {
  createVehicleController,
  deactivateVehicleController,
  listPilotVehiclesController,
  listVehiclesController,
  updateVehicleController,
} from '../controllers/vehicle.controller.js';

export const vehicleRouter = Router();
vehicleRouter.get('/pilot', listPilotVehiclesController);
vehicleRouter.get('/', listVehiclesController);
vehicleRouter.post('/', createVehicleController);
vehicleRouter.patch('/:id', updateVehicleController);
vehicleRouter.delete('/:id', deactivateVehicleController);
