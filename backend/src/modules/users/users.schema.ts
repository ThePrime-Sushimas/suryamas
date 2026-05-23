import { z } from '@/lib/openapi'

const employeeIdSchema = z.string().min(1).max(50)

export const userIdSchema = z.object({
  params: z.object({
    userId: employeeIdSchema,
  }),
})
