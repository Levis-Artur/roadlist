import cors from 'cors';
import express from 'express';
import { adminRouter } from './routes/admin.routes.js';
import { auditRouter } from './routes/audit.routes.js';
import { officerRouter } from './routes/officer.routes.js';
import { photoRouter } from './routes/photo.routes.js';
import { routeSheetRouter } from './routes/routeSheet.routes.js';
import { vehicleRouter } from './routes/vehicle.routes.js';
import { pilotRouter } from './routes/pilot.routes.js';
import { AppError, errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';

export const app = express();

app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);

app.get('/api/health', (_request, response) => response.json({ success: true, service: 'route-sheet-api' }));
app.use('/api/officers', officerRouter);
app.use('/api/route-sheets', routeSheetRouter);
app.use('/api/photos', photoRouter);
app.use('/api/admin', adminRouter);
app.use('/api/audit-logs', auditRouter);
app.use('/api/vehicles', vehicleRouter);
app.use('/api/pilot', pilotRouter);

app.use((_request, _response, next) => next(new AppError('Маршрут API не знайдено.', 404)));
app.use(errorHandler);
