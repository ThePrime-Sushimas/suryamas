import { z } from 'zod'

export const journalLineSchema = z.object({
  line_number: z.number().int().positive(),
  account_id: z.string().uuid(),
  description: z.string().optional(),
  debit_amount: z.number().min(0),
  credit_amount: z.number().min(0)
}).refine(
  data => (data.debit_amount > 0 && data.credit_amount === 0) || (data.credit_amount > 0 && data.debit_amount === 0),
  { message: 'Line must have either debit or credit, not both' }
)

export const createJournalSchema = z.object({
  body: z.object({
    journal_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    journal_type: z.enum(['MANUAL', 'PURCHASE', 'SALES', 'PAYMENT', 'RECEIPT', 'ADJUSTMENT', 'OPENING', 'CLOSING']),
    description: z.string().min(1).max(500),
    currency: z.string().length(3).optional(),
    exchange_rate: z.number().positive().optional(),
    reference_type: z.string().optional(),
    reference_id: z.string().uuid().optional(),
    reference_number: z.string().optional(),
    source_module: z.string().optional(),
    tags: z.record(z.any()).optional(),
    lines: z.array(journalLineSchema).min(2, 'Journal must have at least 2 lines')
  })
})

export const updateJournalSchema = z.object({
  params: z.object({
    id: z.string().uuid()
  }),
  body: z.object({
    journal_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    description: z.string().min(1).max(500).optional(),
    lines: z.array(journalLineSchema).min(2, 'Journal must have at least 2 lines').optional()
  })
})

export const journalIdSchema = z.object({
  params: z.object({
    id: z.string().uuid()
  })
})

export const submitJournalSchema = z.object({
  params: z.object({
    id: z.string().uuid()
  }),
  body: z.object({}).optional()
})

export const rejectJournalSchema = z.object({
  params: z.object({
    id: z.string().uuid()
  }),
  body: z.object({
    rejection_reason: z.string().min(1).max(500)
  })
})

export const reverseJournalSchema = z.object({
  params: z.object({
    id: z.string().uuid()
  }),
  body: z.object({
    reversal_reason: z.string().min(1).max(500)
  })
})
