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
  jwtSecret,
  adminJwtExpiresIn: process.env.ADMIN_JWT_EXPIRES_IN ?? process.env.JWT_EXPIRES_IN ?? '2h',
  adminTwoFactorPendingExpiresIn: process.env.ADMIN_2FA_PENDING_EXPIRES_IN ?? '5m',
  officerJwtExpiresIn: process.env.OFFICER_JWT_EXPIRES_IN ?? process.env.JWT_EXPIRES_IN ?? '12h',
  nodeEnv,
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
};
