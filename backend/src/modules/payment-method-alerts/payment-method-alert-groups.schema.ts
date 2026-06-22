import { z } from '@/lib/openapi'

export const createAlertGroupSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(255),
    payment_method_ids: z.array(z.number().int().positive()).min(2, 'Minimal 2 payment method'),
    threshold_amount: z.number().positive(),
    telegram_chat_id: z.string().min(1),
    is_active: z.boolean().optional().default(true),
  }),
})

export const updateAlertGroupSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    name: z.string().min(1).max(255).optional(),
    payment_method_ids: z.array(z.number().int().positive()).min(2, 'Minimal 2 payment method').optional(),
    threshold_amount: z.number().positive().optional(),
    telegram_chat_id: z.string().min(1).optional(),
    is_active: z.boolean().optional(),
  }),
})

export const alertGroupIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
})
