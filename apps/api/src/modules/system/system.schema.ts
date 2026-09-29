import { z } from 'zod';

export const updateConditionsSchema = z.object({
  isTrafficJam: z.boolean().optional(),
  isRaining: z.boolean().optional(),
});

export type UpdateConditionsInput = z.infer<typeof updateConditionsSchema>;

