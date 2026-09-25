import { z } from 'zod';
import { ZONES } from '../../config/zones.js';

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
    openToShare: z.boolean().optional().default(false),
    maxShareSeats: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional().default(0),
  })
  .refine((data) => Boolean(data.destinationZone || data.dropoffZone), {
    message: 'Either destinationZone or dropoffZone must be provided',
    path: ['destinationZone'],
  })
  .superRefine((data, ctx) => {
    const seats = data.seats ?? data.passengerCount ?? 1;
    const extra = data.openToShare ? data.maxShareSeats : 0;
    if (seats + extra > 3) {
      ctx.addIssue({
        code: 'custom',
        path: ['maxShareSeats'],
        message: 'Your seats plus additional share seats cannot exceed 3',
      });
    }
  });

export type RequestRideInput = z.infer<typeof requestRideSchema>;

export const availableSharesQuerySchema = z.object({
  pickupZone: zoneEnum,
  destinationZone: zoneEnum,
  seats: z.coerce.number().int().min(1).max(3).optional().default(1),
});

export type AvailableSharesQuery = z.infer<typeof availableSharesQuerySchema>;

export const joinPoolSchema = z.object({
  destinationZone: zoneEnum,
  seats: z.number().int().min(1).max(3).optional().default(1),
});

export type JoinPoolInput = z.infer<typeof joinPoolSchema>;

export const shareableQuerySchema = z.object({
  search: z.string().optional(),
});

export type ShareableQuery = z.infer<typeof shareableQuerySchema>;
