import { z } from '../../../lib/openapi'

const ENTRY_TYPES = [
  'BANK_FEE', 'INTEREST', 'TRANSFER_IN', 'TRANSFER_OUT',
  'SUPPLIER_PAYMENT', 'RECEIVABLE', 'REFUND', 'TAX_PAYMENT', 'PAYROLL', 'OTHER',
] as const

/** POST /reconcile — one-step create + reconcile */
export const reconcileWithMutationEntrySchema = z.object({
  body: z.object({
    bankStatementId: z.coerce.string().min(1, 'Bank Statement ID wajib diisi'),
    entryType: z.enum(ENTRY_TYPES, { message: 'Entry type tidak valid' }),
    description: z.string().min(1, 'Deskripsi wajib diisi').max(500),
    referenceNumber: z.string().max(100).optional(),
    coaId: z.string().uuid('COA ID harus UUID valid'),
    entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD').optional(),
    amount: z.number().optional(),
    notes: z.string().max(1000).optional(),
  }),
})

/** POST /:id/void */
export const voidMutationEntrySchema = z.object({
  params: z.object({
    id: z.string().uuid('ID harus UUID valid'),
  }),
  body: z.object({
    voidReason: z.string().min(1, 'Alasan void wajib diisi').max(500),
  }),
})

/** GET / — list */
export const listMutationEntriesSchema = z.object({
  query: z.object({
    bankAccountId: z.coerce.number().int().positive().optional(),
    entryType: z.enum(ENTRY_TYPES).optional(),
    status: z.enum(['ACTIVE', 'VOIDED']).optional(),
    isReconciled: z.string().optional().transform(v => v === 'true' ? true : v === 'false' ? false : undefined),
    dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    search: z.string().max(200).optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(500).optional().default(50),
  }),
})

/** GET /coa-suggestions?entryType=... */
export const coaSuggestionsSchema = z.object({
  query: z.object({
    entryType: z.enum(ENTRY_TYPES, { message: 'Entry type tidak valid' }),
  }),
})

export type ReconcileWithMutationEntryInput = z.infer<typeof reconcileWithMutationEntrySchema>
export type VoidMutationEntryInput = z.infer<typeof voidMutationEntrySchema>
export type ListMutationEntriesInput = z.infer<typeof listMutationEntriesSchema>
export type CoaSuggestionsInput = z.infer<typeof coaSuggestionsSchema>
