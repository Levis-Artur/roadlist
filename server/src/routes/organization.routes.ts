import { Router } from 'express';
import {
  createDepartmentController,
  createDepartmentUnitController,
  listDepartmentsController,
  listDepartmentUnitsController,
  updateDepartmentController,
  updateDepartmentUnitController,
} from '../controllers/organization.controller.js';
import { authAdmin } from '../middleware/authAdmin.js';

export const departmentRouter = Router();
export const departmentUnitRouter = Router();

departmentRouter.get('/', authAdmin, listDepartmentsController);
departmentRouter.post('/', authAdmin, createDepartmentController);
departmentRouter.patch('/:id', authAdmin, updateDepartmentController);

departmentUnitRouter.get('/', authAdmin, listDepartmentUnitsController);
departmentUnitRouter.post('/', authAdmin, createDepartmentUnitController);
departmentUnitRouter.patch('/:id', authAdmin, updateDepartmentUnitController);
