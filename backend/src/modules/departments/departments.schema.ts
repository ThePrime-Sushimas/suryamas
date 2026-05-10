import { z } from '@/lib/openapi'

export const createDepartmentSchema = z.object({
  body: z.object({
    department_code: z.string().min(1).max(20),
    department_name: z.string().min(1).max(100),
    sort_order: z.number().int().optional().default(0),
  }),
})

export const updateDepartmentSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    department_name: z.string().min(1).max(100).optional(),
    sort_order: z.number().int().optional(),
    is_active: z.boolean().optional(),
  }),
})

export const departmentIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
})
