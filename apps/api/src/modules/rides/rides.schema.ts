import { z } from 'zod';
import { ZONES, Zone } from '../../config/zones.js';

export const zoneEnum = z.enum(ZONES);

export const estimateRideSchema = z
  .object({
    pickupZone: zoneEnum,
    dropoffZone: zoneEnum.optional(),
    destinationZone: zoneEnum.optional(),
    passengerCount: z.number().int().min(1).max(3).optional().default(1),
    seats: z.number().int().min(1).max(3).optional(),
  })
  .refine((data) => Boolean(data.dropoffZone || data.destinationZone), {
    message: 'Either dropoffZone or destinationZone must be provided',
    path: ['dropoffZone'],
  });

export type EstimateRideInput = z.infer<typeof estimateRideSchema>;

export const requestRideSchema = z
  .object({
    pickupZone: zoneEnum,
    destinationZone: zoneEnum.optional(),
    dropoffZone: zoneEnum.optional(),
    seats: z.number().int().min(1).max(3).optional().default(1),
    passengerCount: z.number().int().min(1).max(3).optional(),
  })
  .refine((data) => Boolean(data.destinationZone || data.dropoffZone), {
    message: 'Either destinationZone or dropoffZone must be provided',
    path: ['destinationZone'],
  });

export type RequestRideInput = z.infer<typeof requestRideSchema>;