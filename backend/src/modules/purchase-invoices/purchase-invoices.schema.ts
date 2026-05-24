import { z } from '@/lib/openapi'

const uuidParam = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
})

export const purchaseInvoiceIdParamSchema = uuidParam

export const listPurchaseInvoicesSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    status: z
      .string()
      .refine((val) => {
        const list = val.split(',').map((s) => s.trim())
        return list.every((s) => ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'POSTED'].includes(s))
      }, { message: 'Invalid status value' })
      .optional(),
    supplier_id: z.string().uuid().optional(),
    branch_id: z.string().uuid().optional(),
    date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    search: z.string().trim().max(100).optional(),
  }),
})

const lineSchema = z.object({
  gr_line_id: z.string().uuid(),
  qty_invoiced: z.coerce.number().positive(),
  unit_price: z.coerce.number().min(0),
  tax_rate: z.coerce.number().min(0),
  sort_order: z.coerce.number().int().default(0),
})

const chargeTypes = ['DISCOUNT', 'SHIPPING', 'ADMIN_FEE', 'OTHER'] as const

const chargeSchema = z
  .object({
    charge_type: z.enum(chargeTypes),
    description: z.string().max(255).nullable().optional(),
    amount: z.coerce.number(),
    tax_rate: z.coerce.number().min(0),
    sort_order: z.coerce.number().int().default(0),
    affects_dpp: z.boolean().optional().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.charge_type === 'DISCOUNT' && data.amount > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Diskon wajib nilai negatif atau nol (pengurang tagihan).',
        path: ['amount'],
      })
    }
    if (data.charge_type === 'SHIPPING' && data.amount < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Ongkir tidak boleh negatif.',
        path: ['amount'],
      })
    }
    if (data.charge_type === 'ADMIN_FEE' && data.amount < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Biaya admin tidak boleh negatif.',
        path: ['amount'],
      })
    }
    if (data.affects_dpp && data.charge_type !== 'DISCOUNT') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Memperkecil DPP hanya untuk jenis Diskon.',
        path: ['affects_dpp'],
      })
    }
    if (data.affects_dpp && data.tax_rate > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Diskon yang memperkecil DPP tidak boleh memiliki PPN pada baris charge (PPN dihitung dari DPP net barang).',
        path: ['tax_rate'],
      })
    }
  })

export const createPurchaseInvoiceSchema = z.object({
  body: z.object({
    supplier_id: z.string().uuid(),
    branch_id: z.string().uuid(),
    invoice_number: z.string().min(1).max(100),
    invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    notes: z.string().nullable().optional(),
    lines: z.array(lineSchema).min(1),
    charges: z.array(chargeSchema).optional().default([]),
    supplier_bank_account_id: z.number().int().positive().nullable().optional(),
  }),
})

export const updatePurchaseInvoiceSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    invoice_number: z.string().min(1).max(100),
    invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    notes: z.string().nullable().optional(),
    lines: z.array(lineSchema).min(1),
    charges: z.array(chargeSchema).optional().default([]),
    supplier_bank_account_id: z.number().int().positive().nullable().optional(),
  }),
})

export const submitPurchaseInvoiceSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
})

export const approvePurchaseInvoiceSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z
    .object({
      rejection_reason: z.string().min(1).optional(),
    })
    .optional(),
})

export const rejectPurchaseInvoiceSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    rejection_reason: z.string().min(1, 'Alasan penolakan wajib diisi'),
  }),
})

export const availableGrsSchema = z.object({
  query: z.object({
    supplier_id: z.string().uuid(),
    branch_id: z.string().uuid(),
  }),
})

export const deletePurchaseInvoiceSchema = uuidParam

export const postPurchaseInvoiceSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
})

export const unpostPurchaseInvoiceSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
})

const splitNotaSchema = z.object({
  invoice_number: z.string().min(1).max(100),
  invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(500).nullable().optional(),
  gr_line_ids: z.array(z.string().uuid()).min(1, 'Setiap nota wajib memiliki minimal 1 baris'),
  supplier_bank_account_id: z.number().int().positive().nullable().optional(),
})

export const splitPurchaseInvoiceSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    splits: z
      .array(splitNotaSchema)
      .min(2, 'Minimal 2 nota — untuk 1 nota saja, edit invoice staging tanpa pecah'),
  }),
})

export const mergePurchaseInvoicesSchema = z.object({
  body: z.object({
    invoice_ids: z.array(z.string().uuid()).min(2),
  }),
})

