import { z } from '@/lib/openapi'

const uuidParam = z.object({ id: z.string().uuid() })

// ─── Request Schemas ──────────────────────────────────────────────────────────

export const createRequestSchema = z.object({
  body: z.object({
    branch_id: z.string().uuid(),
    amount_requested: z.number().positive(),
    petty_cash_coa_id: z.string().uuid(),
    description: z.string().max(1000).optional(),
  }),
})

export const approveRequestSchema = z.object({
  params: uuidParam,
  body: z.object({
    source_bank_account_id: z.number().int().positive(),
    amount_disbursed: z.number().positive(),
    notes: z.string().max(1000).optional(),
  }),
})

export const rejectRequestSchema = z.object({
  params: uuidParam,
  body: z.object({
    rejection_reason: z.string().min(1).max(500),
  }),
})

export const getRequestSchema = z.object({
  params: uuidParam,
})

export const listRequestsSchema = z.object({
  query: z.object({
    branch_id: z.string().uuid().optional(),
    status: z.enum(['PENDING', 'DISBURSED', 'CLOSED', 'REJECTED']).optional(),
    date_from: z.string().date().optional(),
    date_to: z.string().date().optional(),
    search: z.string().max(100).optional(),
    page: z.coerce.number().int().min(1).default(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25).optional(),
    sort_by: z.string().optional(),
    sort_order: z.enum(['asc', 'desc']).optional(),
  }),
})

// ─── Expense Schemas ──────────────────────────────────────────────────────────

export const createExpenseSchema = z.object({
  params: uuidParam,
  body: z.object({
    category_id: z.string().uuid(),
    sub_category_id: z.string().uuid().optional(),
    expense_date: z.string().date().optional(),
    amount: z.number().positive(),
    description: z.string().max(1000).optional(),
    expense_coa_id: z.string().uuid().optional(),
    // Inventory mode
    product_id: z.string().uuid().optional(),
    product_uom_id: z.string().uuid().optional(),
    warehouse_id: z.string().uuid().optional(),
    qty: z.number().positive().optional(),
    unit_price: z.number().min(0).optional(),
    // Asset mode
    asset_category_id: z.string().uuid().optional(),
    asset_name: z.string().min(1).max(255).optional(),
    asset_qty: z.number().int().min(1).optional(),
    useful_life_months: z.number().int().min(1).optional(),
    salvage_value: z.number().min(0).optional(),
  }).refine(
    (d) => !(d.warehouse_id && d.asset_category_id),
    { message: 'warehouse_id dan asset_category_id tidak bisa diisi bersamaan', path: ['asset_category_id'] },
  ).refine(
    (d) => !d.asset_category_id || !!d.asset_name,
    { message: 'asset_name wajib diisi jika asset_category_id diset', path: ['asset_name'] },
  ),
})


export const updateExpenseSchema = z.object({
  params: uuidParam,
  body: z.object({
    category_id: z.string().uuid().optional(),
    sub_category_id: z.string().uuid().nullable().optional(),
    expense_date: z.string().date().optional(),
    amount: z.number().positive().optional(),
    description: z.string().max(1000).nullable().optional(),
    product_id: z.string().uuid().nullable().optional(),
    product_uom_id: z.string().uuid().nullable().optional(),
    warehouse_id: z.string().uuid().nullable().optional(),
    qty: z.number().positive().nullable().optional(),
    unit_price: z.number().min(0).nullable().optional(),
    expense_coa_id: z.string().uuid().nullable().optional(),
  }),
})

export const deleteExpenseSchema = z.object({
  params: uuidParam,
})

export const listExpensesSchema = z.object({
  params: uuidParam,
  query: z.object({
    page: z.coerce.number().int().min(1).default(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25).optional(),
  }),
})

// ─── Settlement Schemas ───────────────────────────────────────────────────────

export const createSettlementSchema = z.object({
  params: uuidParam,
  body: z.object({
    settlement_date: z.string().date().optional(),
    amount_returned: z.number().min(0),
    return_bank_account_id: z.number().int().positive().optional(),
    refill_amount: z.number().min(0).optional(),
    refill_bank_account_id: z.number().int().positive().optional(),
    notes: z.string().max(1000).optional(),
  }),
})

export const voidSettlementSchema = z.object({
  params: uuidParam,
  body: z.object({
    reason: z.string().min(1).max(500),
  }),
})


// ─── Report Schema ────────────────────────────────────────────────────────────

export const expenseReportSchema = z.object({
  query: z.object({
    branch_id: z.string().uuid().optional(),
    date_from: z.string().date().optional(),
    date_to: z.string().date().optional(),
    search: z.string().max(100).optional(),
    limit: z.coerce.number().int().optional(),
  }),
})
