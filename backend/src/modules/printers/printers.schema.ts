import { z } from '@/lib/openapi'

export const createPrinterSchema = z.object({
  body: z.object({
    branch_id: z.string().uuid().optional().nullable(),
    printer_name: z.string().min(1).max(100),
    ip_address: z.string().min(7).max(45), // IPv4/IPv6
    port: z.number().int().min(1).max(65535),
    paper_width: z.number().int().min(58).max(80).optional(),
    is_default: z.boolean().optional(),
    is_active: z.boolean().optional(),
  }),
})

export const updatePrinterSchema = z.object({
  body: z.object({
    branch_id: z.string().uuid().optional().nullable(),
    printer_name: z.string().min(1).max(100).optional(),
    ip_address: z.string().min(7).max(45).optional(),
    port: z.number().int().min(1).max(65535).optional(),
    paper_width: z.number().int().min(58).max(80).optional(),
    is_default: z.boolean().optional(),
    is_active: z.boolean().optional(),
  }).refine((data) => Object.keys(data).length > 0, { message: 'At least one field required' }),
  params: z.object({ id: z.string().uuid() }),
})

export const printerIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
})

export const printPurchaseRequestSchema = z.object({
  body: z.object({
    printer_id: z.string().uuid(),
    line_ids: z.array(z.string().uuid()).min(1, 'Pilih minimal 1 item untuk dicetak'),
  }),
  params: z.object({ id: z.string().uuid() }),
})

export const printGoodsReceiptSchema = z.object({
  body: z.object({
    printer_id: z.string().uuid(),
    line_ids: z.array(z.string().uuid()).min(1, 'Pilih minimal 1 item untuk dicetak'),
  }),
  params: z.object({ id: z.string().uuid() }),
})

export const printDailyPrepOrderSchema = z.object({
  body: z.object({
    printer_id: z.string().uuid(),
    line_ids: z.array(z.string().uuid()).min(1, 'Pilih minimal 1 item untuk dicetak'),
  }),
  params: z.object({ id: z.string().uuid() }),
})

export const printStockTransferSchema = z.object({
  body: z.object({
    printer_id: z.string().uuid(),
    line_ids: z.array(z.string().uuid()).min(1, 'Pilih minimal 1 item untuk dicetak'),
  }),
  params: z.object({ id: z.string().uuid() }),
})
