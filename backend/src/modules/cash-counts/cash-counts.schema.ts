import { z } from '@/lib/openapi'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const VALID_STATUSES = ['OPEN', 'COUNTED', 'DEPOSITED', 'CLOSED'] as const

export const previewSchema = z.object({
  query: z.object({
    start_date: z.string().regex(DATE_REGEX, 'Format tanggal harus YYYY-MM-DD'),
    end_date: z.string().regex(DATE_REGEX, 'Format tanggal harus YYYY-MM-DD'),
    payment_method_id: z.coerce.number().int().positive(),
  }),
})

export const createCashCountSchema = z.object({
  body: z.object({
    start_date: z.string().regex(DATE_REGEX, 'Format tanggal harus YYYY-MM-DD'),
    end_date: z.string().regex(DATE_REGEX, 'Format tanggal harus YYYY-MM-DD'),
    branch_name: z.string().nullable().optional(),
    payment_method_id: z.coerce.number().int().positive('Payment method ID harus positif'),
    notes: z.string().optional(),
  }).refine(
    (data) => new Date(data.end_date) >= new Date(data.start_date),
    { message: 'end_date harus >= start_date' }
  ),
})

export const cashCountIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid cash count ID'),
  }),
})

export const updatePhysicalCountSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid cash count ID'),
  }),
  body: z.object({
    large_denomination: z.coerce.number().min(0, 'Pecahan besar harus >= 0'),
    small_denomination: z.coerce.number().min(0, 'Pecahan kecil harus >= 0'),
    responsible_employee_id: z.string().uuid().nullable().optional(),
    notes: z.string().optional(),
  }),
})

export const depositSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid cash count ID'),
  }),
  body: z.object({
    deposit_amount: z.coerce.number().min(0, 'Deposit amount harus >= 0'),
    deposit_date: z.string().regex(DATE_REGEX, 'Format tanggal harus YYYY-MM-DD'),
    deposit_bank_account_id: z.coerce.number().int().positive(),
    deposit_reference: z.string().optional(),
    notes: z.string().optional(),
  }),
})

export const cashCountListQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    branch_id: z.string().uuid().optional(),
    payment_method_id: z.coerce.number().int().positive().optional(),
    status: z.enum(VALID_STATUSES).optional(),
    start_date: z.string().regex(DATE_REGEX).optional(),
    end_date: z.string().regex(DATE_REGEX).optional(),
    sort_by: z.string().optional(),
    sort_order: z.enum(['asc', 'desc']).optional(),
  }),
})
