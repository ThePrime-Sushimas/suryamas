import { z } from 'zod'

export const journalLineIdSchema = z.object({
  params: z.object({
    journalId: z.string().uuid(),
    id: z.string().uuid()
  })
})

export const journalLinesListSchema = z.object({
  params: z.object({
    journalId: z.string().uuid()
  })
})

export const journalLinesByAccountSchema = z.object({
  params: z.object({
    accountId: z.string().uuid()
  }),
  query: z.object({
    journal_status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'POSTED', 'REVERSED', 'REJECTED', 'POSTED_ONLY']).optional(),
    date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    include_reversed: z.string().transform(val => val === 'true').optional(),
    show_deleted: z.string().transform(val => val === 'true').optional()
  }).optional()
})

export const journalLinesAllSchema = z.object({
  query: z.object({
    page: z.string().transform(val => parseInt(val) || 1).optional(),
    limit: z.string().transform(val => parseInt(val) || 20).optional(),
    account_id: z.string().uuid().optional(),
    journal_type: z.enum(['EXPENSE','PURCHASE','SALES','INVENTORY','CASH','BANK','ASSET','TAX','GENERAL','OPENING','RECEIVABLE','PAYROLL','PAYABLE','FINANCING']).optional(),
    journal_status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'POSTED', 'REVERSED', 'REJECTED', 'POSTED_ONLY']).optional(),
    date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    period_from: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    period_to: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    include_reversed: z.string().transform(val => val === 'true').optional(),
    show_deleted: z.string().transform(val => val === 'true').optional(),
    search: z.string().optional()
  }).optional()
})
