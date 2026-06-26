import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config();

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProduction = nodeEnv === 'production';

function numberFromEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function requiredInProduction(name: string): string | undefined {
  const value = process.env[name]?.trim();
  if (isProduction && !value) {
    throw new Error(`Production env error: ${name} is required.`);
  }
  return value;
}

function parseCorsOrigins(value: string | undefined): string[] {
  if (!value?.trim()) {
    return isProduction
      ? []
      : [
          'http://localhost:5173',
          'http://127.0.0.1:5173',
          'http://localhost:4173',
          'http://127.0.0.1:4173',
          'http://localhost:3000',
          'http://127.0.0.1:3000',
        ];
  }
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const databaseUrl = requiredInProduction('DATABASE_URL') ?? '';
const jwtSecret = requiredInProduction('JWT_SECRET') ?? 'CHANGE_ME_SECRET';
const uploadDirValue = requiredInProduction('UPLOAD_DIR') ?? './uploads';
const corsOrigins = parseCorsOrigins(requiredInProduction('CORS_ORIGIN'));

if (isProduction) {
  if (jwtSecret === 'CHANGE_ME_SECRET' || jwtSecret.startsWith('CHANGE_ME') || jwtSecret.length < 32) {
    throw new Error('Production env error: JWT_SECRET must be a long random value and cannot use CHANGE_ME placeholders.');
  }
  if (corsOrigins.length === 0 || corsOrigins.includes('*')) {
    throw new Error('Production env error: CORS_ORIGIN must explicitly list allowed origins and cannot be "*".');
  }
  if (uploadDirValue === './uploads') {
    throw new Error('Production env error: UPLOAD_DIR must be explicitly configured.');
  }
}

export const env = {
  host: process.env.HOST ?? '0.0.0.0',
  port: numberFromEnv(process.env.PORT, 4000),
  databaseUrl,
  uploadDir: path.resolve(process.cwd(), uploadDirValue),
  uploadMaxBytes: numberFromEnv(process.env.UPLOAD_MAX_BYTES, 10 * 1024 * 1024),
  jwtSecret,
  adminJwtExpiresIn: process.env.ADMIN_JWT_EXPIRES_IN ?? process.env.JWT_EXPIRES_IN ?? '2h',
  adminTwoFactorPendingExpiresIn: process.env.ADMIN_2FA_PENDING_EXPIRES_IN ?? '5m',
  officerJwtExpiresIn: process.env.OFFICER_JWT_EXPIRES_IN ?? process.env.JWT_EXPIRES_IN ?? '12h',
  nodeEnv,
  isProduction,
  corsOrigins,
};
