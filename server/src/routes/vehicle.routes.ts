import { Router } from 'express';
import {
  createVehicleController,
  deactivateVehicleController,
  listVehicleTransferHistoryController,
  listAvailableVehiclesController,
  listVehiclesController,
  transferVehicleController,
  updateVehicleController,
} from '../controllers/vehicle.controller.js';
import { authAdmin } from '../middleware/authAdmin.js';
import { authOfficer } from '../middleware/authOfficer.js';

export const vehicleRouter = Router();
vehicleRouter.get('/available', authOfficer, listAvailableVehiclesController);
vehicleRouter.get('/', authAdmin, listVehiclesController);
vehicleRouter.post('/', authAdmin, createVehicleController);
vehicleRouter.get('/:id/transfer-history', authAdmin, listVehicleTransferHistoryController);
vehicleRouter.post('/:id/transfer', authAdmin, transferVehicleController);
vehicleRouter.patch('/:id', authAdmin, updateVehicleController);
vehicleRouter.delete('/:id', authAdmin, deactivateVehicleController);
