import { EntityManager, MoreThanOrEqual, LessThan } from 'typeorm';
import { Booking } from '../../bookings/entities/booking.entity';

/**
 * Generates a readable, unique booking number of the form GH-<YEAR>-<seq>,
 * e.g. GH-2026-000001.
 */
export async function generateBookingNumber(manager: EntityManager): Promise<string> {
  const year = new Date().getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));

  const countThisYear = await manager.count(Booking, {
    where: {
      createdAt: MoreThanOrEqual(yearStart),
    },
  });

  const sequence = (countThisYear + 1).toString().padStart(6, '0');
  return `GH-${year}-${sequence}`;
}
