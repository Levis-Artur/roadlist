import { Router } from 'express';
import {
  createVehicleController,
  deactivateVehicleController,
  listAvailableVehiclesController,
  listVehiclesController,
  updateVehicleController,
} from '../controllers/vehicle.controller.js';
import { authAdmin } from '../middleware/authAdmin.js';
import { authOfficer } from '../middleware/authOfficer.js';

export const vehicleRouter = Router();
vehicleRouter.get('/available', authOfficer, listAvailableVehiclesController);
vehicleRouter.get('/', authAdmin, listVehiclesController);
vehicleRouter.post('/', authAdmin, createVehicleController);
vehicleRouter.patch('/:id', authAdmin, updateVehicleController);
vehicleRouter.delete('/:id', authAdmin, deactivateVehicleController);
