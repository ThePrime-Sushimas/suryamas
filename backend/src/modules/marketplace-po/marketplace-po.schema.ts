import { z } from '@/lib/openapi'

export const ownerCreditCardIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
})

export const ownerCreditCardListSchema = z.object({
  query: z
    .object({
      is_active: z.coerce.boolean().optional(),
    })
    .default({}),
})

export const createOwnerCreditCardSchema = z.object({
  body: z.object({
    card_label: z.string().min(1).max(100),
    bank_name: z.string().min(1).max(100),
    last4: z.string().length(4).nullable().optional(),
    coa_code: z.string().min(1).max(20),
    is_active: z.boolean().optional().default(true),
    sort_order: z.number().int().optional().default(0),
  }),
})

export const updateOwnerCreditCardSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    card_label: z.string().min(1).max(100).optional(),
    bank_name: z.string().min(1).max(100).optional(),
    last4: z.string().length(4).nullable().optional(),
    coa_code: z.string().min(1).max(20).optional(),
    is_active: z.boolean().optional(),
    sort_order: z.number().int().optional(),
  }).refine(v => Object.keys(v).length > 0, 'No fields to update'),
})

export const pendingPoLinesSchema = z.object({
  query: z.object({
    platform: z.enum(['SHOPEE', 'TOKOPEDIA']).optional(),
    branch_id: z.string().uuid().optional(),
  }),
})

export const listMarketplaceSessionsSchema = z.object({
  query: z.object({
    platform: z.enum(['SHOPEE', 'TOKOPEDIA']).optional(),
    status: z.enum(['DRAFT', 'ORDERED', 'SHIPPED', 'RECEIVED', 'SETTLED', 'CANCELLED']).optional(),
    branch_id: z.string().uuid().optional(),
    cc_id: z.string().uuid().optional(),
    date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    search: z.string().max(200).optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(25),
  }),
})

export const marketplaceSessionIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
})

export const createMarketplaceSessionSchema = z.object({
  body: z.object({
    platform: z.enum(['SHOPEE', 'TOKOPEDIA']),
    cc_id: z.string().uuid(),
    checkout_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    notes: z.string().max(2000).nullable().optional(),
    lines: z.array(
      z.object({
        po_id: z.string().uuid(),
        po_line_id: z.string().uuid(),
        branch_id: z.string().uuid(),
        product_id: z.string().uuid(),
        qty: z.number().positive(),
        unit_price_netto: z.number().min(0),
        platform_order_id: z.string().max(100).nullable().optional(),
        platform_item_id: z.string().max(100).nullable().optional(),
        notes: z.string().max(2000).nullable().optional(),
      }),
    ).min(1),
  }),
})

export const updateMarketplaceSessionSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    platform: z.enum(['SHOPEE', 'TOKOPEDIA']).optional(),
    cc_id: z.string().uuid().optional(),
    checkout_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    notes: z.string().max(2000).nullable().optional(),
  }),
})

export const cancelMarketplaceSessionSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
})

export const orderMarketplaceSessionSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    platform_order_ids: z.array(z.string().max(100)).optional(),
    platform_receipt_url: z.string().max(500).nullable().optional(),
    journal_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    reference: z.string().max(200).nullable().optional(),
  }).optional(),
})

export const shipMarketplaceSessionSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    shipments: z.array(
      z.object({
        branch_id: z.string().uuid(),
        tracking_number: z.string().max(100),
        courier: z.string().max(50).nullable().optional(),
        shipped_at: z.string().datetime().optional().nullable(),
        notes: z.string().max(1000).nullable().optional(),
      }),
    ).min(1),
  }),
})

export const receiveMarketplaceSessionSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ journal_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).optional(),
})

export const settleMarketplaceSessionSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    bank_account_id: z.coerce.number().int().positive(),
    amount: z.number().min(0),
    reference_number: z.string().max(100),
    settled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    notes: z.string().max(2000).nullable().optional(),
  }),
})

export const uploadMarketplaceAttachmentSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    file_type: z.enum(['BUKTI_BAYAR', 'SCREENSHOT_CHECKOUT', 'INVOICE_MARKETPLACE', 'OTHER']),
  }),
})

export const deleteMarketplaceAttachmentSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
    attachmentId: z.string().uuid(),
  }),
})

export const bulkSettleMarketplaceSessionSchema = z.object({
  body: z.object({
    session_ids: z.array(z.string().uuid()).min(1, "Pilih minimal 1 sesi"),
    bank_account_id: z.coerce.number().int().positive("Bank account ID harus valid"),
    amount: z.coerce.number().positive("Jumlah harus lebih dari 0"),
    reference_number: z.string().min(1, "Nomor referensi wajib diisi"),
    settled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal salah (YYYY-MM-DD)"),
    notes: z.string().optional().nullable(),
  }),
})

export const createMarketplaceShipmentSchema = shipMarketplaceSessionSchema