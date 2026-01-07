import { z } from 'zod'

const uuidSchema = z.string().uuid()

export const userIdSchema = z.object({
  params: z.object({
    userId: uuidSchema,
  }),
})

export const assignRoleSchema = z.object({
  params: z.object({
    userId: uuidSchema,
  }),
  body: z.object({
    role_id: uuidSchema,
  }),
})

export const removeRoleSchema = z.object({
  params: z.object({
    userId: uuidSchema,
  }),
})