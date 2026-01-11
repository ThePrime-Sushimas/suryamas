import { z } from '@/lib/openapi'

const uuidSchema = z.string().uuid()
const employeeIdSchema = z.string().min(1).max(50) // Accept employee_id format

export const userIdSchema = z.object({
  params: z.object({
    userId: employeeIdSchema, // Changed from uuidSchema to employeeIdSchema
  }),
})

export const assignRoleSchema = z.object({
  params: z.object({
    userId: employeeIdSchema, // Changed from uuidSchema to employeeIdSchema
  }),
  body: z.object({
    role_id: uuidSchema,
  }),
})

export const removeRoleSchema = z.object({
  params: z.object({
    userId: employeeIdSchema, // Changed from uuidSchema to employeeIdSchema
  }),
})