import type { RouteSheet } from '../types';

const STORAGE_KEY = 'patrol-route-sheets';

type LegacyRouteSheet = RouteSheet & { startPhoto?: string; endPhoto?: string; rank?: string };

function assertDevOnlyStorage() {
  if (import.meta.env.PROD) {
    throw new Error('Локальне сховище маршрутних листів вимкнене у production.');
  }
}

function sanitizeRouteSheets(routeSheets: LegacyRouteSheet[]): RouteSheet[] {
  return routeSheets.map(({ startPhoto: _startPhoto, endPhoto: _endPhoto, rank: _rank, ...routeSheet }) => routeSheet);
}

export const routeSheetStorage = {
  getAll(): RouteSheet[] {
    assertDevOnlyStorage();
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      if (!value) return [];
      const parsed = JSON.parse(value) as LegacyRouteSheet[];
      const hasLegacyFields = parsed.some((item) => item.startPhoto || item.endPhoto || item.rank);
      const routeSheets = sanitizeRouteSheets(parsed);
      if (hasLegacyFields) {
        try {
          this.saveAll(routeSheets);
        } catch {
          // The cleaned data can still be used even if legacy storage cannot be rewritten.
        }
      }
      return routeSheets;
    } catch {
      return [];
    }
  },

  saveAll(routeSheets: RouteSheet[]): void {
    assertDevOnlyStorage();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeRouteSheets(routeSheets as LegacyRouteSheet[])));
  },

  add(routeSheet: RouteSheet): void {
    this.saveAll([routeSheet, ...this.getAll()]);
  },

  update(routeSheet: RouteSheet): void {
    this.saveAll(this.getAll().map((item) => (item.id === routeSheet.id ? routeSheet : item)));
  },

  clear(): void {
    assertDevOnlyStorage();
    localStorage.removeItem(STORAGE_KEY);
  },
};
