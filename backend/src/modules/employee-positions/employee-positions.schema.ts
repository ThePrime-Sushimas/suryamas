import { z } from '@/lib/openapi'

export const assignPositionSchema = z.object({
  params: z.object({ employeeId: z.string().uuid() }),
  body: z.object({
    position_id: z.string().uuid(),
    is_primary: z.boolean().optional().default(false),
  }),
})

export const removePositionSchema = z.object({
  params: z.object({
    employeeId: z.string().uuid(),
    positionId: z.string().uuid(),
  }),
})

export const setPrimarySchema = z.object({
  params: z.object({
    employeeId: z.string().uuid(),
    positionId: z.string().uuid(),
  }),
})

export const listEmployeePositionsSchema = z.object({
  params: z.object({ employeeId: z.string().uuid() }),
})
