export const BADGE_NUMBER_ERROR = 'Номер жетона має містити рівно 7 цифр.';
export const BADGE_NUMBER_PATTERN = /^\d{7}$/;

export function sanitizeBadgeNumber(value: string): string {
  return value.replace(/\D/g, '').slice(0, 7);
}

export function isValidBadgeNumber(value: string): boolean {
  return BADGE_NUMBER_PATTERN.test(value);
}
