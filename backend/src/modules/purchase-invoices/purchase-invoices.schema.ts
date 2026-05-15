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
  }),
})

const lineSchema = z.object({
  gr_line_id: z.string().uuid(),
  qty_invoiced: z.coerce.number().positive(),
  unit_price: z.coerce.number().min(0),
  tax_rate: z.coerce.number().min(0),
  sort_order: z.coerce.number().int().default(0),
})

export const createPurchaseInvoiceSchema = z.object({
  body: z.object({
    supplier_id: z.string().uuid(),
    branch_id: z.string().uuid(),
    invoice_number: z.string().min(1).max(100),
    invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    notes: z.string().nullable().optional(),
    lines: z.array(lineSchema).min(1),
  }),
})

export const updatePurchaseInvoiceSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    notes: z.string().nullable().optional(),
    lines: z.array(lineSchema).min(1),
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

export const deletePurchaseInvoiceSchema = z.object({
  ...uuidParam,
})

export const postPurchaseInvoiceSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
})

