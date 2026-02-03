import { z } from '@/lib/openapi'

export const registerSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    employee_id: z.string().min(1, 'Employee ID is required'),
  }),
})

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(1, 'Password is required'),
  }),
})

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
  }),
})

export const resetPasswordSchema = z.object({
  body: z.object({
    password: z.string().min(8),
    recovery_token: z.string().optional(),
  }),
})
