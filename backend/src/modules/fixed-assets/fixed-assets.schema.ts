import { z } from '@/lib/openapi'

// ─── Shared ──────────────────────────────────────────────────────────────────

const uuidParam = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
})

export const fixedAssetIdParamSchema = uuidParam

// ─── Asset Categories ────────────────────────────────────────────────────────

export const createAssetCategorySchema = z.object({
  body: z.object({
    category_code: z.string().min(1).max(10),
    category_name: z.string().min(1).max(100),
    asset_coa_id: z.string().uuid(),
    depreciation_expense_coa_id: z.string().uuid(),
    accumulated_depreciation_coa_id: z.string().uuid(),
    default_useful_life_months: z.coerce.number().int().min(1).default(60),
    is_active: z.boolean().optional().default(true),
  }),
})

export const updateAssetCategorySchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    category_code: z.string().min(1).max(10).optional(),
    category_name: z.string().min(1).max(100).optional(),
    asset_coa_id: z.string().uuid().optional(),
    depreciation_expense_coa_id: z.string().uuid().optional(),
    accumulated_depreciation_coa_id: z.string().uuid().optional(),
    default_useful_life_months: z.coerce.number().int().min(1).optional(),
    is_active: z.boolean().optional(),
  }),
})

export const listAssetCategoriesSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(25),
    search: z.string().trim().max(100).optional(),
    is_active: z.coerce.boolean().optional(),
  }),
})

// ─── Fixed Assets ────────────────────────────────────────────────────────────

export const listFixedAssetsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(25),
    status: z
      .string()
      .refine((val) => {
        const list = val.split(',').map((s) => s.trim())
        return list.every((s) => ['DRAFT', 'ACTIVE', 'MAINTENANCE', 'DISPOSED'].includes(s))
      }, { message: 'Invalid status value' })
      .optional(),
    category_id: z.string().uuid().optional(),
    branch_id: z.string().uuid().optional(),
    search: z.string().trim().max(100).optional(),
    date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),
})

export const updateFixedAssetSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    asset_name: z.string().min(1).max(200).optional(),
    description: z.string().max(500).nullable().optional(),
    serial_number: z.string().max(100).nullable().optional(),
    location_note: z.string().max(200).nullable().optional(),
    salvage_value: z.coerce.number().min(0).optional(),
    useful_life_months: z.coerce.number().int().min(1).optional(),
  }),
})

// ─── Asset Transfers ─────────────────────────────────────────────────────────

export const createTransferSchema = z.object({
  body: z.object({
    fixed_asset_id: z.string().uuid(),
    destination_branch_id: z.string().uuid(),
    transfer_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    reason: z.string().max(500).optional(),
  }),
})

export const listTransfersSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(25),
    fixed_asset_id: z.string().uuid().optional(),
    branch_id: z.string().uuid().optional(),
    date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),
})

// ─── Asset Maintenance ───────────────────────────────────────────────────────

export const createMaintenanceSchema = z.object({
  body: z.object({
    fixed_asset_id: z.string().uuid(),
    maintenance_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    description: z.string().min(1).max(500),
    vendor_name: z.string().max(200).optional(),
    cost: z.coerce.number().min(0),
    reference_number: z.string().max(100).optional(),
  }),
})

export const completeMaintenanceSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    completion_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }).optional(),
})

export const listMaintenanceSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(25),
    fixed_asset_id: z.string().uuid().optional(),
    status: z
      .string()
      .refine((val) => {
        const list = val.split(',').map((s) => s.trim())
        return list.every((s) => ['IN_PROGRESS', 'COMPLETED', 'POSTED'].includes(s))
      }, { message: 'Invalid maintenance status value' })
      .optional(),
    date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    search: z.string().trim().max(100).optional(),
  }),
})

export const postMaintenanceSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
})

// ─── Asset Disposals ─────────────────────────────────────────────────────────

export const createDisposalSchema = z.object({
  body: z.object({
    fixed_asset_id: z.string().uuid(),
    disposal_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    disposal_method: z.enum(['SOLD', 'SCRAPPED', 'DONATED']),
    proceeds_amount: z.coerce.number().min(0),
    notes: z.string().max(500).nullable().optional(),
  }),
})

export const postDisposalSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
})

export const listDisposalsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(25),
    fixed_asset_id: z.string().uuid().optional(),
    status: z
      .string()
      .refine((val) => {
        const list = val.split(',').map((s) => s.trim())
        return list.every((s) => ['DRAFT', 'POSTED'].includes(s))
      }, { message: 'Invalid disposal status value' })
      .optional(),
    disposal_method: z.enum(['SOLD', 'SCRAPPED', 'DONATED']).optional(),
    date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),
})

// ─── Depreciation Runs ───────────────────────────────────────────────────────

export const previewDepreciationSchema = z.object({
  body: z.object({
    fiscal_period_id: z.string().uuid(),
  }),
})

export const confirmDepreciationSchema = z.object({
  body: z.object({
    fiscal_period_id: z.string().uuid(),
  }),
})

export const reverseDepreciationSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
})

export const listDepreciationRunsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(25),
    status: z
      .string()
      .refine((val) => {
        const list = val.split(',').map((s) => s.trim())
        return list.every((s) => ['PREVIEW', 'POSTED', 'REVERSED'].includes(s))
      }, { message: 'Invalid depreciation run status value' })
      .optional(),
    fiscal_period_id: z.string().uuid().optional(),
  }),
})

// ─── Movements ───────────────────────────────────────────────────────────────

export const listMovementsSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  query: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(25),
    movement_type: z
      .string()
      .refine((val) => {
        const list = val.split(',').map((s) => s.trim())
        return list.every((s) =>
          ['CAPITALIZE', 'DEPRECIATION', 'TRANSFER', 'MAINTENANCE', 'MAINTENANCE_COMPLETE', 'DISPOSAL', 'COST_ADJUSTMENT'].includes(s)
        )
      }, { message: 'Invalid movement type value' })
      .optional(),
  }),
})

// ─── Activate Asset (DRAFT → ACTIVE) ─────────────────────────────────────────

export const activateAssetSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    capitalized_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }).optional(),
})

// ─── QR Code ─────────────────────────────────────────────────────────────────

export const regenerateQrCodeSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
})

export const bulkQrCodeSchema = z.object({
  body: z.object({
    asset_ids: z.array(z.string().uuid()).min(1).max(100),
  }),
})
