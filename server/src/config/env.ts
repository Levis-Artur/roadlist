import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config();

const nodeEnv = process.env.NODE_ENV ?? 'development';
const jwtSecret = process.env.JWT_SECRET ?? 'CHANGE_ME_SECRET';
if (nodeEnv === 'production' && jwtSecret === 'CHANGE_ME_SECRET') {
  throw new Error('JWT_SECRET must be configured in production.');
}

function numberFromEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export const env = {
  host: process.env.HOST ?? '0.0.0.0',
  port: numberFromEnv(process.env.PORT, 4000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  uploadDir: path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? './uploads'),
  adminPassword: process.env.ADMIN_PASSWORD ?? 'admin123',
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '12h',
  nodeEnv,
  pilotMode: process.env.PILOT_MODE?.toLocaleLowerCase() === 'true',
  pilotDepartment: process.env.PILOT_DEPARTMENT ?? 'УПП у Волинській області',
  pilotStartDate: process.env.PILOT_START_DATE ?? '2026-06-19',
  pilotEndDate: process.env.PILOT_END_DATE ?? '2026-06-26',
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
};
