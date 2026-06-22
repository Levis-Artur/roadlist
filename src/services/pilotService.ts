import type { PilotStatus } from '../types';
import { apiGet, isApiUnavailableError } from './apiClient';
import { getPilotVehicles } from './vehicleService';

export { getPilotVehicles } from './vehicleService';

const PILOT_DEPARTMENT = 'УПП у Волинській області';

interface PilotStatusResponse { success: boolean; pilot: PilotStatus }

export async function getPilotStatus(): Promise<PilotStatus> {
  try {
    return (await apiGet<PilotStatusResponse>('/api/pilot/status')).pilot;
  } catch (error) {
    if (!isApiUnavailableError(error)) throw error;
    const now = Date.now();
    const startDate = '2026-06-19';
    const endDate = '2026-06-26';
    const ended = now > new Date(`${endDate}T23:59:59.999`).getTime();
    return {
      enabled: true,
      active: now >= new Date(`${startDate}T00:00:00`).getTime() && !ended,
      ended,
      department: PILOT_DEPARTMENT,
      startDate,
      endDate,
      vehicleCount: (await getPilotVehicles()).length,
      officerCount: 3,
    };
  }
}
