import cors from 'cors';
import express from 'express';
import { adminRouter } from './routes/admin.routes.js';
import { auditRouter } from './routes/audit.routes.js';
import { officerRouter } from './routes/officer.routes.js';
import { photoRouter } from './routes/photo.routes.js';
import { routeSheetRouter } from './routes/routeSheet.routes.js';
import { vehicleRouter } from './routes/vehicle.routes.js';
import { monthlyRouteSheetRouter } from './routes/monthlyRouteSheet.routes.js';
import { departmentRouter, departmentUnitRouter } from './routes/organization.routes.js';
import { AppError, errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { env } from './config/env.js';

export const app = express();

app.disable('x-powered-by');
app.use(cors({ origin: env.corsOrigin }));
app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);

app.get('/api/health', (_request, response) => response.json({ success: true, service: 'route-sheet-api' }));
app.use('/api/officers', officerRouter);
app.use('/api/route-sheets', routeSheetRouter);
app.use('/api/photos', photoRouter);
app.use('/api/admin', adminRouter);
app.use('/api/admin-users', adminRouter);
app.use('/api/audit-logs', auditRouter);
app.use('/api/vehicles', vehicleRouter);
app.use('/api/monthly-route-sheets', monthlyRouteSheetRouter);
app.use('/api/departments', departmentRouter);
app.use('/api/department-units', departmentUnitRouter);

app.use((_request, _response, next) => next(new AppError('Маршрут API не знайдено.', 404)));
app.use(errorHandler);
