import { Router } from 'express';
import {
  createDepartmentController,
  createDepartmentUnitController,
  deleteDepartmentController,
  deleteDepartmentUnitController,
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
departmentRouter.delete('/:id', authAdmin, deleteDepartmentController);

departmentUnitRouter.get('/', authAdmin, listDepartmentUnitsController);
departmentUnitRouter.post('/', authAdmin, createDepartmentUnitController);
departmentUnitRouter.patch('/:id', authAdmin, updateDepartmentUnitController);
departmentUnitRouter.delete('/:id', authAdmin, deleteDepartmentUnitController);
