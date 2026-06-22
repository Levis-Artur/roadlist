import { AppError } from '../middleware/errorHandler.js';

export const BADGE_NUMBER_PATTERN = /^\d{7}$/;
export const BADGE_NUMBER_ERROR = 'Номер жетона має містити рівно 7 цифр';

export function validateBadgeNumber(value: unknown): string {
  const badgeNumber = typeof value === 'string' ? value.trim() : '';
  if (!BADGE_NUMBER_PATTERN.test(badgeNumber)) throw new AppError(BADGE_NUMBER_ERROR, 400);
  return badgeNumber;
}
