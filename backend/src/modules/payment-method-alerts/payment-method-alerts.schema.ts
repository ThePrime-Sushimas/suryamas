import { z } from '@/lib/openapi'

export const createAlertSchema = z.object({
  body: z.object({
    payment_method_id: z.number().int().positive(),
    threshold_amount: z.number().positive(),
    telegram_chat_id: z.string().min(1),
    is_active: z.boolean().optional().default(true),
  }),
})

export const updateAlertSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    payment_method_id: z.number().int().positive().optional(),
    threshold_amount: z.number().positive().optional(),
    telegram_chat_id: z.string().min(1).optional(),
    is_active: z.boolean().optional(),
  }),
})

export const alertIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
})
