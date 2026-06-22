const UKRAINIAN_TO_LATIN: Record<string, string> = {
  А: 'A', В: 'B', С: 'C', Е: 'E', Н: 'H', І: 'I',
  К: 'K', М: 'M', О: 'O', Р: 'P', Т: 'T', Х: 'X',
};

export function normalizeVehicleNumber(value: string): string {
  return value
    .toLocaleUpperCase('uk-UA')
    .replace(/\s/g, '')
    .replace(/[АВСЕНІКМОРТХ]/g, (letter) => UKRAINIAN_TO_LATIN[letter]);
}
