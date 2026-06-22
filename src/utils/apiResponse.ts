type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function objectItems<T>(value: unknown): T[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((item): item is T => typeof item === 'object' && item !== null);
}

export function extractList<T>(response: unknown, key: string): T[] {
  const direct = objectItems<T>(response);
  if (direct) return direct;
  if (!isRecord(response)) return [];

  const keyed = objectItems<T>(response[key]);
  if (keyed) return keyed;

  for (const containerKey of ['data', 'items', 'result']) {
    const container = response[containerKey];
    const containerArray = objectItems<T>(container);
    if (containerArray) return containerArray;
    if (isRecord(container)) {
      const nested = objectItems<T>(container[key]);
      if (nested) return nested;
    }
  }
  return [];
}

export function extractEntity<T extends object>(response: unknown, key: string): T | null {
  if (!isRecord(response)) return null;
  if (isRecord(response[key])) return response[key] as T;
  for (const containerKey of ['data', 'result']) {
    const container = response[containerKey];
    if (!isRecord(container)) continue;
    if (isRecord(container[key])) return container[key] as T;
    return container as T;
  }
  return null;
}
