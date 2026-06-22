import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';

export async function getPilotStatus() {
  const now = new Date();
  const startsAt = new Date(`${env.pilotStartDate}T00:00:00`);
  const endsAt = new Date(`${env.pilotEndDate}T23:59:59.999`);
  const ended = env.pilotMode && now.getTime() > endsAt.getTime();
  const active = env.pilotMode && now.getTime() >= startsAt.getTime() && !ended;
  const [vehicleCount, officerCount] = await Promise.all([
    prisma.vehicle.count({ where: { department: env.pilotDepartment, isActive: true, isPilotActive: true } }),
    prisma.pilotOfficerAccess.count({ where: { department: env.pilotDepartment, isActive: true } }),
  ]);
  return {
    enabled: env.pilotMode,
    active,
    ended,
    department: env.pilotDepartment,
    startDate: env.pilotStartDate,
    endDate: env.pilotEndDate,
    vehicleCount,
    officerCount,
  };
}
