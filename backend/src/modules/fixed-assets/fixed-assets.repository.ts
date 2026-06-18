import { pool } from '../../config/db'
import type { PoolClient } from 'pg'
import type {
  AssetCategory,
  FixedAsset,
  AssetTransfer,
  AssetMaintenance,
  AssetDisposal,
  DepreciationRun,
  DepreciationEntry,
  AssetMovement,
  AssetStatus,
  MovementType,
  DepreciationPreviewEntry,
} from './fixed-assets.types'
import { FixedAssetNotFoundError } from './fixed-assets.errors'

// ─── Asset Categories ────────────────────────────────────────────────────────

export async function findCategories(
  companyId: string,
  client?: PoolClient,
): Promise<AssetCategory[]> {
  const db = client ?? pool
  const { rows } = await db.query<AssetCategory>(
    `SELECT ac.*,
       coa_asset.account_code AS asset_coa_code,
       coa_asset.account_name AS asset_coa_name,
       coa_depr.account_code AS depreciation_expense_coa_code,
       coa_depr.account_name AS depreciation_expense_coa_name,
       coa_accum.account_code AS accumulated_depreciation_coa_code,
       coa_accum.account_name AS accumulated_depreciation_coa_name
     FROM asset_categories ac
     LEFT JOIN chart_of_accounts coa_asset ON coa_asset.id = ac.asset_coa_id
     LEFT JOIN chart_of_accounts coa_depr ON coa_depr.id = ac.depreciation_expense_coa_id
     LEFT JOIN chart_of_accounts coa_accum ON coa_accum.id = ac.accumulated_depreciation_coa_id
     WHERE ac.company_id = $1 AND ac.deleted_at IS NULL
     ORDER BY ac.category_code ASC`,
    [companyId],
  )
  return rows
}

export async function findCategoryById(
  id: string,
  companyId: string,
  client?: PoolClient,
): Promise<AssetCategory | null> {
  const db = client ?? pool
  const { rows } = await db.query<AssetCategory>(
    `SELECT * FROM asset_categories
     WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
    [id, companyId],
  )
  return rows[0] ?? null
}

export async function findCategoryByCode(
  companyId: string,
  categoryCode: string,
  client?: PoolClient,
): Promise<AssetCategory | null> {
  const db = client ?? pool
  const { rows } = await db.query<AssetCategory>(
    `SELECT * FROM asset_categories
     WHERE company_id = $1 AND category_code = $2 AND deleted_at IS NULL`,
    [companyId, categoryCode],
  )
  return rows[0] ?? null
}

export async function createCategory(
  data: {
    company_id: string
    category_code: string
    category_name: string
    asset_coa_id: string
    depreciation_expense_coa_id: string
    accumulated_depreciation_coa_id: string
    default_useful_life_months: number
    created_by?: string
  },
  client?: PoolClient,
): Promise<AssetCategory> {
  const db = client ?? pool
  const { rows } = await db.query<AssetCategory>(
    `INSERT INTO asset_categories
       (company_id, category_code, category_name, asset_coa_id,
        depreciation_expense_coa_id, accumulated_depreciation_coa_id,
        default_useful_life_months, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
     RETURNING *`,
    [
      data.company_id,
      data.category_code,
      data.category_name,
      data.asset_coa_id,
      data.depreciation_expense_coa_id,
      data.accumulated_depreciation_coa_id,
      data.default_useful_life_months,
      data.created_by ?? null,
    ],
  )
  return rows[0]
}

export async function updateCategory(
  id: string,
  companyId: string,
  data: {
    category_name?: string
    asset_coa_id?: string
    depreciation_expense_coa_id?: string
    accumulated_depreciation_coa_id?: string
    default_useful_life_months?: number
    is_active?: boolean
    updated_by?: string
  },
  client?: PoolClient,
): Promise<AssetCategory | null> {
  const db = client ?? pool
  const fields: string[] = ['updated_at = now()']
  const params: unknown[] = []
  let idx = 1

  if (data.category_name !== undefined) {
    params.push(data.category_name)
    fields.push(`category_name = $${idx++}`)
  }
  if (data.asset_coa_id !== undefined) {
    params.push(data.asset_coa_id)
    fields.push(`asset_coa_id = $${idx++}`)
  }
  if (data.depreciation_expense_coa_id !== undefined) {
    params.push(data.depreciation_expense_coa_id)
    fields.push(`depreciation_expense_coa_id = $${idx++}`)
  }
  if (data.accumulated_depreciation_coa_id !== undefined) {
    params.push(data.accumulated_depreciation_coa_id)
    fields.push(`accumulated_depreciation_coa_id = $${idx++}`)
  }
  if (data.default_useful_life_months !== undefined) {
    params.push(data.default_useful_life_months)
    fields.push(`default_useful_life_months = $${idx++}`)
  }
  if (data.is_active !== undefined) {
    params.push(data.is_active)
    fields.push(`is_active = $${idx++}`)
  }
  if (data.updated_by !== undefined) {
    params.push(data.updated_by)
    fields.push(`updated_by = $${idx++}`)
  }

  params.push(id, companyId)
  const { rows } = await db.query<AssetCategory>(
    `UPDATE asset_categories SET ${fields.join(', ')}
     WHERE id = $${idx++} AND company_id = $${idx} AND deleted_at IS NULL
     RETURNING *`,
    params,
  )
  return rows[0] ?? null
}

export async function softDeleteCategory(
  id: string,
  companyId: string,
  userId?: string,
  client?: PoolClient,
): Promise<boolean> {
  const db = client ?? pool
  const { rowCount } = await db.query(
    `UPDATE asset_categories
     SET deleted_at = now(), is_deleted = true, updated_by = $1, updated_at = now()
     WHERE id = $2 AND company_id = $3 AND deleted_at IS NULL`,
    [userId ?? null, id, companyId],
  )
  return (rowCount ?? 0) > 0
}

export async function findCategoryByIdIncludeDeleted(
  id: string,
  companyId: string,
  client?: PoolClient,
): Promise<AssetCategory | null> {
  const db = client ?? pool
  const { rows } = await db.query<AssetCategory>(
    `SELECT * FROM asset_categories WHERE id = $1 AND company_id = $2`,
    [id, companyId],
  )
  return rows[0] ?? null
}

export async function restoreCategory(
  id: string,
  companyId: string,
  userId?: string,
  client?: PoolClient,
): Promise<AssetCategory | null> {
  const db = client ?? pool
  const { rows } = await db.query<AssetCategory>(
    `UPDATE asset_categories
     SET deleted_at = NULL, is_deleted = false, updated_by = $1, updated_at = now()
     WHERE id = $2 AND company_id = $3 AND deleted_at IS NOT NULL
     RETURNING *`,
    [userId ?? null, id, companyId],
  )
  return rows[0] ?? null
}

export async function findCategoriesPaginated(
  companyId: string,
  pagination: { limit: number; offset: number },
  filter?: { search?: string; is_active?: boolean },
  client?: PoolClient,
): Promise<{ data: AssetCategory[]; total: number }> {
  const db = client ?? pool
  // For COUNT query (no alias needed)
  const countConditions = ['company_id = $1', 'deleted_at IS NULL']
  // For data query (needs ac. prefix due to joins)
  const dataConditions = ['ac.company_id = $1', 'ac.deleted_at IS NULL']
  const params: unknown[] = [companyId]
  let idx = 2

  if (filter?.is_active !== undefined) {
    params.push(filter.is_active)
    countConditions.push(`is_active = $${idx}`)
    dataConditions.push(`ac.is_active = $${idx}`)
    idx++
  }
  if (filter?.search?.trim()) {
    params.push(`%${filter.search.trim()}%`)
    countConditions.push(`(category_code ILIKE $${idx} OR category_name ILIKE $${idx})`)
    dataConditions.push(`(ac.category_code ILIKE $${idx} OR ac.category_name ILIKE $${idx})`)
    idx++
  }

  const countWhere = `WHERE ${countConditions.join(' AND ')}`
  const dataWhere = `WHERE ${dataConditions.join(' AND ')}`
  const limitIdx = idx
  const offsetIdx = idx + 1
  params.push(pagination.limit, pagination.offset)

  const [dataRes, countRes] = await Promise.all([
    db.query<AssetCategory>(
      `SELECT ac.*,
         coa_asset.account_code AS asset_coa_code,
         coa_asset.account_name AS asset_coa_name,
         coa_depr.account_code AS depreciation_expense_coa_code,
         coa_depr.account_name AS depreciation_expense_coa_name,
         coa_accum.account_code AS accumulated_depreciation_coa_code,
         coa_accum.account_name AS accumulated_depreciation_coa_name
       FROM asset_categories ac
       LEFT JOIN chart_of_accounts coa_asset ON coa_asset.id = ac.asset_coa_id
       LEFT JOIN chart_of_accounts coa_depr ON coa_depr.id = ac.depreciation_expense_coa_id
       LEFT JOIN chart_of_accounts coa_accum ON coa_accum.id = ac.accumulated_depreciation_coa_id
       ${dataWhere}
       ORDER BY ac.category_code ASC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params,
    ),
    db.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM asset_categories ${countWhere}`,
      params.slice(0, idx - 1),
    ),
  ])

  return { data: dataRes.rows, total: countRes.rows[0].total }
}

export async function isCategoryInUse(
  categoryId: string,
  companyId: string,
  client?: PoolClient,
): Promise<boolean> {
  const db = client ?? pool
  const { rows } = await db.query<{ exists: boolean }>(
    `SELECT EXISTS(
       SELECT 1 FROM fixed_assets
       WHERE asset_category_id = $1 AND company_id = $2 AND deleted_at IS NULL
     ) AS exists`,
    [categoryId, companyId],
  )
  return rows[0].exists
}

// ─── Fixed Assets ────────────────────────────────────────────────────────────

export async function findAssets(
  companyId: string,
  pagination: { limit: number; offset: number },
  filter?: {
    branch_id?: string
    status?: string
    asset_category_id?: string
    search?: string
    date_from?: string
    date_to?: string
  },
  client?: PoolClient,
): Promise<{ data: FixedAsset[]; total: number }> {
  const db = client ?? pool
  const conditions = ['fa.company_id = $1', 'fa.deleted_at IS NULL']
  const params: unknown[] = [companyId]
  let idx = 2

  if (filter?.branch_id) {
    params.push(filter.branch_id)
    conditions.push(`fa.branch_id = $${idx++}`)
  }
  if (filter?.status) {
    const trimmed = filter.status.trim()
    if (trimmed.includes(',')) {
      params.push(trimmed.split(',').map((s) => s.trim()))
      conditions.push(`fa.status = ANY($${idx++}::text[])`)
    } else {
      params.push(trimmed)
      conditions.push(`fa.status = $${idx++}`)
    }
  }
  if (filter?.asset_category_id) {
    params.push(filter.asset_category_id)
    conditions.push(`fa.asset_category_id = $${idx++}`)
  }
  if (filter?.search?.trim()) {
    params.push(`%${filter.search.trim()}%`)
    conditions.push(`(fa.asset_code ILIKE $${idx} OR fa.asset_name ILIKE $${idx})`)
    idx++
  }
  if (filter?.date_from) {
    params.push(filter.date_from)
    conditions.push(`fa.acquisition_date >= $${idx++}`)
  }
  if (filter?.date_to) {
    params.push(filter.date_to)
    conditions.push(`fa.acquisition_date <= $${idx++}`)
  }

  const where = `WHERE ${conditions.join(' AND ')}`

  // Early-pagination pattern: paginate in subquery before any potential joins
  const limitIdx = idx
  const offsetIdx = idx + 1
  params.push(pagination.limit, pagination.offset)

  const [dataRes, countRes] = await Promise.all([
    db.query<FixedAsset>(
      `SELECT fa.*,
         b.branch_name,
         ac.category_name,
         ac.category_code
       FROM (
         SELECT fa.* FROM fixed_assets fa
         ${where}
         ORDER BY fa.created_at DESC
         LIMIT $${limitIdx} OFFSET $${offsetIdx}
       ) fa
       LEFT JOIN branches b ON b.id = fa.branch_id
       LEFT JOIN asset_categories ac ON ac.id = fa.asset_category_id`,
      params,
    ),
    db.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM fixed_assets fa ${where}`,
      params.slice(0, idx - 1), // exclude limit/offset for count
    ),
  ])

  return { data: dataRes.rows, total: countRes.rows[0].total }
}

export async function findById(
  id: string,
  companyId: string,
  client?: PoolClient,
): Promise<FixedAsset | null> {
  const db = client ?? pool
  const { rows } = await db.query<FixedAsset>(
    `SELECT fa.*,
       b.branch_name,
       ac.category_name,
       ac.category_code
     FROM fixed_assets fa
     LEFT JOIN branches b ON b.id = fa.branch_id
     LEFT JOIN asset_categories ac ON ac.id = fa.asset_category_id
     WHERE fa.id = $1 AND fa.company_id = $2 AND fa.deleted_at IS NULL`,
    [id, companyId],
  )
  return rows[0] ?? null
}

export async function findByIds(
  ids: string[],
  companyId: string,
  client?: PoolClient,
): Promise<FixedAsset[]> {
  if (ids.length === 0) return []
  const db = client ?? pool
  const { rows } = await db.query<FixedAsset>(
    `SELECT * FROM fixed_assets
     WHERE id = ANY($1::uuid[]) AND company_id = $2 AND deleted_at IS NULL`,
    [ids, companyId],
  )
  return rows
}

export async function findCategoriesByIds(
  ids: string[],
  companyId: string,
  client?: PoolClient,
): Promise<AssetCategory[]> {
  if (ids.length === 0) return []
  const db = client ?? pool
  const { rows } = await db.query<AssetCategory>(
    `SELECT * FROM asset_categories
     WHERE id = ANY($1::uuid[]) AND company_id = $2 AND deleted_at IS NULL`,
    [ids, companyId],
  )
  return rows
}

export async function findByGrLineId(
  grLineId: string,
  companyId: string,
  client?: PoolClient,
): Promise<FixedAsset[]> {
  const db = client ?? pool
  const { rows } = await db.query<FixedAsset>(
    `SELECT * FROM fixed_assets
     WHERE gr_line_id = $1 AND company_id = $2 AND deleted_at IS NULL`,
    [grLineId, companyId],
  )
  return rows
}

export async function findDepreciableAssets(
  companyId: string,
  client?: PoolClient,
): Promise<FixedAsset[]> {
  const db = client ?? pool
  const { rows } = await db.query<FixedAsset>(
    `SELECT * FROM fixed_assets
     WHERE company_id = $1
       AND deleted_at IS NULL
       AND status IN ('ACTIVE', 'MAINTENANCE')
       AND (cost - salvage_value) > accumulated_depreciation`,
    [companyId],
  )
  return rows
}

export async function capitalize(
  id: string,
  companyId: string,
  data: {
    cost: number
    capitalized_date: string
    purchase_invoice_id: string
    status: AssetStatus
    updated_by: string
  },
  client?: PoolClient,
): Promise<void> {
  const db = client ?? pool
  await db.query(
    `UPDATE fixed_assets
     SET cost = $1, capitalized_date = $2, purchase_invoice_id = $3,
         status = $4, updated_by = $5, updated_at = now()
     WHERE id = $6 AND company_id = $7 AND deleted_at IS NULL`,
    [data.cost, data.capitalized_date, data.purchase_invoice_id, data.status, data.updated_by, id, companyId],
  )
}

export async function activateAsset(
  id: string,
  companyId: string,
  data: { capitalized_date: string; updated_by: string },
  client?: PoolClient,
): Promise<void> {
  const db = client ?? pool
  const { rowCount } = await db.query(
    `UPDATE fixed_assets
     SET status = 'ACTIVE', capitalized_date = $1, updated_by = $2, updated_at = now()
     WHERE id = $3 AND company_id = $4 AND deleted_at IS NULL AND status = 'DRAFT'`,
    [data.capitalized_date, data.updated_by, id, companyId],
  )
  if ((rowCount ?? 0) === 0) {
    throw new FixedAssetNotFoundError(id)
  }
}

export async function revertCapitalization(
  id: string,
  companyId: string,
  data: { cost: number; updated_by: string },
  client?: PoolClient,
): Promise<void> {
  const db = client ?? pool
  await db.query(
    `UPDATE fixed_assets
     SET cost = $1, capitalized_date = NULL, purchase_invoice_id = NULL,
         status = 'DRAFT', journal_id = NULL, updated_by = $2, updated_at = now()
     WHERE id = $3 AND company_id = $4 AND deleted_at IS NULL`,
    [data.cost, data.updated_by, id, companyId],
  )
}

export async function updateBranchId(
  id: string,
  branchId: string,
  userId: string,
  client?: PoolClient,
): Promise<void> {
  const db = client ?? pool
  await db.query(
    `UPDATE fixed_assets
     SET branch_id = $1, updated_by = $2, updated_at = now()
     WHERE id = $3`,
    [branchId, userId, id],
  )
}

export async function incrementAccumulatedDepreciation(
  id: string,
  amount: number,
  client?: PoolClient,
): Promise<void> {
  const db = client ?? pool
  await db.query(
    `UPDATE fixed_assets
     SET accumulated_depreciation = accumulated_depreciation + $1, updated_at = now()
     WHERE id = $2`,
    [amount, id],
  )
}

export async function decrementAccumulatedDepreciation(
  id: string,
  amount: number,
  client?: PoolClient,
): Promise<void> {
  const db = client ?? pool
  await db.query(
    `UPDATE fixed_assets
     SET accumulated_depreciation = accumulated_depreciation - $1, updated_at = now()
     WHERE id = $2`,
    [amount, id],
  )
}

export async function updateStatus(
  id: string,
  status: AssetStatus,
  userId: string,
  client?: PoolClient,
): Promise<void> {
  const db = client ?? pool
  await db.query(
    `UPDATE fixed_assets
     SET status = $1, updated_by = $2, updated_at = now()
     WHERE id = $3`,
    [status, userId, id],
  )
}

export async function updateJournalId(
  id: string,
  journalId: string,
  client?: PoolClient,
): Promise<void> {
  const db = client ?? pool
  await db.query(
    `UPDATE fixed_assets SET journal_id = $1, updated_at = now() WHERE id = $2`,
    [journalId, id],
  )
}

export async function createAsset(
  data: {
    company_id: string
    branch_id: string
    asset_code: string
    asset_name: string
    asset_category_id: string
    product_id: string
    status: string
    acquisition_date: string
    cost: number
    salvage_value: number
    useful_life_months: number
    depreciation_method: string
    gr_line_id: string
    qr_code_url?: string | null
    created_by?: string | null
  },
  client?: PoolClient,
): Promise<FixedAsset> {
  const db = client ?? pool
  const { rows } = await db.query<FixedAsset>(
    `INSERT INTO fixed_assets
       (company_id, branch_id, asset_code, asset_name, asset_category_id,
        product_id, status, acquisition_date, cost, salvage_value,
        useful_life_months, depreciation_method, gr_line_id, qr_code_url,
        created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $15)
     RETURNING *`,
    [
      data.company_id,
      data.branch_id,
      data.asset_code,
      data.asset_name,
      data.asset_category_id,
      data.product_id,
      data.status,
      data.acquisition_date,
      data.cost,
      data.salvage_value,
      data.useful_life_months,
      data.depreciation_method,
      data.gr_line_id,
      data.qr_code_url ?? null,
      data.created_by ?? null,
    ],
  )
  return rows[0]
}

export async function updateAssetMetadata(
  id: string,
  companyId: string,
  data: {
    asset_name?: string
    description?: string | null
    serial_number?: string | null
    location_note?: string | null
    photo_url?: string | null
    salvage_value?: number
    useful_life_months?: number
    updated_by?: string
  },
  client?: PoolClient,
): Promise<FixedAsset | null> {
  const db = client ?? pool
  const fields: string[] = ['updated_at = now()']
  const params: unknown[] = []
  let idx = 1

  if (data.asset_name !== undefined) {
    params.push(data.asset_name)
    fields.push(`asset_name = $${idx++}`)
  }
  if (data.description !== undefined) {
    params.push(data.description)
    fields.push(`description = $${idx++}`)
  }
  if (data.serial_number !== undefined) {
    params.push(data.serial_number)
    fields.push(`serial_number = $${idx++}`)
  }
  if (data.location_note !== undefined) {
    params.push(data.location_note)
    fields.push(`location_note = $${idx++}`)
  }
  if (data.photo_url !== undefined) {
    params.push(data.photo_url)
    fields.push(`photo_url = $${idx++}`)
  }
  if (data.salvage_value !== undefined) {
    params.push(data.salvage_value)
    fields.push(`salvage_value = $${idx++}`)
  }
  if (data.useful_life_months !== undefined) {
    params.push(data.useful_life_months)
    fields.push(`useful_life_months = $${idx++}`)
  }
  if (data.updated_by !== undefined) {
    params.push(data.updated_by)
    fields.push(`updated_by = $${idx++}`)
  }

  params.push(id, companyId)
  const { rows } = await db.query<FixedAsset>(
    `UPDATE fixed_assets SET ${fields.join(', ')}
     WHERE id = $${idx++} AND company_id = $${idx} AND deleted_at IS NULL
     RETURNING *`,
    params,
  )
  return rows[0] ?? null
}

export async function findBranchCode(
  branchId: string,
  client?: PoolClient,
): Promise<string | null> {
  const db = client ?? pool
  const { rows } = await db.query<{ branch_code: string }>(
    `SELECT branch_code FROM branches WHERE id = $1`,
    [branchId],
  )
  return rows[0]?.branch_code ?? null
}

export async function updateQrCode(
  id: string,
  qrCodeUrl: string,
  client?: PoolClient,
): Promise<void> {
  const db = client ?? pool
  await db.query(
    `UPDATE fixed_assets SET qr_code_url = $1, updated_at = now() WHERE id = $2`,
    [qrCodeUrl, id],
  )
}

// ─── Asset Transfers ─────────────────────────────────────────────────────────

export async function createTransfer(
  data: {
    company_id: string
    fixed_asset_id: string
    transfer_date: string
    source_branch_id: string
    destination_branch_id: string
    reason?: string | null
    transferred_by?: string | null
    created_by?: string | null
  },
  client?: PoolClient,
): Promise<AssetTransfer> {
  const db = client ?? pool
  const { rows } = await db.query<AssetTransfer>(
    `INSERT INTO asset_transfers
       (company_id, fixed_asset_id, transfer_date, source_branch_id,
        destination_branch_id, reason, transferred_by, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      data.company_id,
      data.fixed_asset_id,
      data.transfer_date,
      data.source_branch_id,
      data.destination_branch_id,
      data.reason ?? null,
      data.transferred_by ?? null,
      data.created_by ?? null,
    ],
  )
  return rows[0]
}

export async function markTransferJournalPosted(
  transferId: string,
  sourceJournalId: string,
  targetJournalId: string,
  client?: PoolClient,
): Promise<void> {
  const db = client ?? pool
  await db.query(
    `UPDATE asset_transfers
     SET journal_posted = true, source_journal_id = $1, target_journal_id = $2
     WHERE id = $3`,
    [sourceJournalId, targetJournalId, transferId],
  )
}

export async function findTransfers(
  companyId: string,
  pagination: { limit: number; offset: number },
  filter?: {
    fixed_asset_id?: string
    branch_id?: string
    date_from?: string
    date_to?: string
  },
  client?: PoolClient,
): Promise<{ data: AssetTransfer[]; total: number }> {
  const db = client ?? pool
  const conditions = ['atr.company_id = $1']
  const params: unknown[] = [companyId]
  let idx = 2

  if (filter?.fixed_asset_id) {
    params.push(filter.fixed_asset_id)
    conditions.push(`atr.fixed_asset_id = $${idx++}`)
  }
  if (filter?.branch_id) {
    params.push(filter.branch_id)
    conditions.push(`(atr.source_branch_id = $${idx} OR atr.destination_branch_id = $${idx})`)
    idx++
  }
  if (filter?.date_from) {
    params.push(filter.date_from)
    conditions.push(`atr.transfer_date >= $${idx++}`)
  }
  if (filter?.date_to) {
    params.push(filter.date_to)
    conditions.push(`atr.transfer_date <= $${idx++}`)
  }

  const where = `WHERE ${conditions.join(' AND ')}`
  const limitIdx = idx
  const offsetIdx = idx + 1
  params.push(pagination.limit, pagination.offset)

  const [dataRes, countRes] = await Promise.all([
    db.query<AssetTransfer>(
      `SELECT atr.*,
              fa.asset_code,
              fa.asset_name,
              source_branch.branch_name AS source_branch_name,
              destination_branch.branch_name AS destination_branch_name
       FROM asset_transfers atr
       JOIN fixed_assets fa ON fa.id = atr.fixed_asset_id
       JOIN branches source_branch ON source_branch.id = atr.source_branch_id
       JOIN branches destination_branch ON destination_branch.id = atr.destination_branch_id
       ${where}
       ORDER BY atr.transfer_date DESC, atr.created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params,
    ),
    db.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM asset_transfers atr ${where}`,
      params.slice(0, idx - 1),
    ),
  ])

  return { data: dataRes.rows, total: countRes.rows[0].total }
}

// ─── Asset Maintenance ───────────────────────────────────────────────────────

export async function createMaintenance(
  data: {
    company_id: string
    fixed_asset_id: string
    maintenance_date: string
    description: string
    vendor_name?: string | null
    cost: number
    reference_number?: string | null
    created_by?: string | null
  },
  client?: PoolClient,
): Promise<AssetMaintenance> {
  const db = client ?? pool
  const { rows } = await db.query<AssetMaintenance>(
    `INSERT INTO asset_maintenance
       (company_id, fixed_asset_id, maintenance_date, description,
        vendor_name, cost, reference_number, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
     RETURNING *`,
    [
      data.company_id,
      data.fixed_asset_id,
      data.maintenance_date,
      data.description,
      data.vendor_name ?? null,
      data.cost,
      data.reference_number ?? null,
      data.created_by ?? null,
    ],
  )
  return rows[0]
}

export async function completeMaintenance(
  id: string,
  companyId: string,
  data: { completion_date: string; updated_by: string },
  client?: PoolClient,
): Promise<AssetMaintenance | null> {
  const db = client ?? pool
  const { rows } = await db.query<AssetMaintenance>(
    `UPDATE asset_maintenance
     SET status = 'COMPLETED', completion_date = $1, updated_by = $2, updated_at = now()
     WHERE id = $3 AND company_id = $4 AND status = 'IN_PROGRESS' AND deleted_at IS NULL
     RETURNING *`,
    [data.completion_date, data.updated_by, id, companyId],
  )
  return rows[0] ?? null
}

export async function findMaintenance(
  companyId: string,
  pagination: { limit: number; offset: number },
  filter?: {
    fixed_asset_id?: string
    status?: string
    search?: string
    date_from?: string
    date_to?: string
  },
  client?: PoolClient,
): Promise<{ data: AssetMaintenance[]; total: number }> {
  const db = client ?? pool
  const conditions = ['company_id = $1', 'deleted_at IS NULL']
  const params: unknown[] = [companyId]
  let idx = 2

  if (filter?.fixed_asset_id) {
    params.push(filter.fixed_asset_id)
    conditions.push(`fixed_asset_id = $${idx++}`)
  }
  if (filter?.status) {
    const trimmed = filter.status.trim()
    if (trimmed.includes(',')) {
      params.push(trimmed.split(',').map((s) => s.trim()))
      conditions.push(`status = ANY($${idx++}::text[])`)
    } else {
      params.push(trimmed)
      conditions.push(`status = $${idx++}`)
    }
  }
  if (filter?.search?.trim()) {
    params.push(`%${filter.search.trim()}%`)
    conditions.push(
      `(description ILIKE $${idx} OR vendor_name ILIKE $${idx} OR reference_number ILIKE $${idx})`,
    )
    idx++
  }
  if (filter?.date_from) {
    params.push(filter.date_from)
    conditions.push(`maintenance_date >= $${idx++}`)
  }
  if (filter?.date_to) {
    params.push(filter.date_to)
    conditions.push(`maintenance_date <= $${idx++}`)
  }

  const where = `WHERE ${conditions.join(' AND ')}`
  const limitIdx = idx
  const offsetIdx = idx + 1
  params.push(pagination.limit, pagination.offset)

  const [dataRes, countRes] = await Promise.all([
    db.query<AssetMaintenance>(
      `SELECT * FROM asset_maintenance ${where}
       ORDER BY maintenance_date DESC, created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params,
    ),
    db.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM asset_maintenance ${where}`,
      params.slice(0, idx - 1),
    ),
  ])

  return { data: dataRes.rows, total: countRes.rows[0].total }
}

export async function findMaintenanceById(
  id: string,
  companyId: string,
  client?: PoolClient,
): Promise<AssetMaintenance | null> {
  const db = client ?? pool
  const { rows } = await db.query<AssetMaintenance>(
    `SELECT * FROM asset_maintenance
     WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`,
    [id, companyId],
  )
  return rows[0] ?? null
}

// ─── Asset Disposals ─────────────────────────────────────────────────────────

export async function createDisposal(
  data: {
    company_id: string
    fixed_asset_id: string
    disposal_date: string
    disposal_method: string
    proceeds_amount: number
    book_value_at_disposal: number
    gain_loss_amount: number
    notes?: string | null
    created_by?: string | null
  },
  client?: PoolClient,
): Promise<AssetDisposal> {
  const db = client ?? pool
  const { rows } = await db.query<AssetDisposal>(
    `INSERT INTO asset_disposals
       (company_id, fixed_asset_id, disposal_date, disposal_method,
        proceeds_amount, book_value_at_disposal, gain_loss_amount, notes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      data.company_id,
      data.fixed_asset_id,
      data.disposal_date,
      data.disposal_method,
      data.proceeds_amount,
      data.book_value_at_disposal,
      data.gain_loss_amount,
      data.notes ?? null,
      data.created_by ?? null,
    ],
  )
  return rows[0]
}

export async function postDisposal(
  id: string,
  companyId: string,
  data: { journal_id: string; posted_by: string },
  client?: PoolClient,
): Promise<AssetDisposal | null> {
  const db = client ?? pool
  const { rows } = await db.query<AssetDisposal>(
    `UPDATE asset_disposals
     SET status = 'POSTED', journal_id = $1, posted_by = $2, posted_at = now(), updated_at = now()
     WHERE id = $3 AND company_id = $4 AND status = 'DRAFT'
     RETURNING *`,
    [data.journal_id, data.posted_by, id, companyId],
  )
  return rows[0] ?? null
}

export async function findDisposals(
  companyId: string,
  pagination: { limit: number; offset: number },
  filter?: {
    fixed_asset_id?: string
    status?: string
    disposal_method?: string
    date_from?: string
    date_to?: string
  },
  client?: PoolClient,
): Promise<{ data: AssetDisposal[]; total: number }> {
  const db = client ?? pool
  const conditions = ['company_id = $1']
  const params: unknown[] = [companyId]
  let idx = 2

  if (filter?.fixed_asset_id) {
    params.push(filter.fixed_asset_id)
    conditions.push(`fixed_asset_id = $${idx++}`)
  }
  if (filter?.status) {
    const trimmed = filter.status.trim()
    if (trimmed.includes(',')) {
      params.push(trimmed.split(',').map((s) => s.trim()))
      conditions.push(`status = ANY($${idx++}::text[])`)
    } else {
      params.push(trimmed)
      conditions.push(`status = $${idx++}`)
    }
  }
  if (filter?.disposal_method) {
    params.push(filter.disposal_method)
    conditions.push(`disposal_method = $${idx++}`)
  }
  if (filter?.date_from) {
    params.push(filter.date_from)
    conditions.push(`disposal_date >= $${idx++}`)
  }
  if (filter?.date_to) {
    params.push(filter.date_to)
    conditions.push(`disposal_date <= $${idx++}`)
  }

  const where = `WHERE ${conditions.join(' AND ')}`
  const limitIdx = idx
  const offsetIdx = idx + 1
  params.push(pagination.limit, pagination.offset)

  const [dataRes, countRes] = await Promise.all([
    db.query<AssetDisposal>(
      `SELECT * FROM asset_disposals ${where}
       ORDER BY disposal_date DESC, created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params,
    ),
    db.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM asset_disposals ${where}`,
      params.slice(0, idx - 1),
    ),
  ])

  return { data: dataRes.rows, total: countRes.rows[0].total }
}

export async function findDisposalById(
  id: string,
  companyId: string,
  client?: PoolClient,
): Promise<AssetDisposal | null> {
  const db = client ?? pool
  const { rows } = await db.query<AssetDisposal>(
    `SELECT * FROM asset_disposals WHERE id = $1 AND company_id = $2`,
    [id, companyId],
  )
  return rows[0] ?? null
}

// ─── Depreciation Runs ───────────────────────────────────────────────────────

export async function createRun(
  data: {
    company_id: string
    fiscal_period_id: string
    status: string
    total_depreciation_amount: number
    asset_count: number
    created_by?: string | null
  },
  client?: PoolClient,
): Promise<DepreciationRun> {
  const db = client ?? pool
  const { rows } = await db.query<DepreciationRun>(
    `INSERT INTO asset_depreciation_runs
       (company_id, fiscal_period_id, status, total_depreciation_amount, asset_count, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      data.company_id,
      data.fiscal_period_id,
      data.status,
      data.total_depreciation_amount,
      data.asset_count,
      data.created_by ?? null,
    ],
  )
  return rows[0]
}

export async function findPostedRun(
  companyId: string,
  fiscalPeriodId: string,
  client?: PoolClient,
): Promise<DepreciationRun | null> {
  const db = client ?? pool
  const { rows } = await db.query<DepreciationRun>(
    `SELECT * FROM asset_depreciation_runs
     WHERE company_id = $1 AND fiscal_period_id = $2 AND status = 'POSTED'`,
    [companyId, fiscalPeriodId],
  )
  return rows[0] ?? null
}

export async function bulkInsertEntries(
  runId: string,
  entries: DepreciationPreviewEntry[],
  client?: PoolClient,
): Promise<void> {
  if (entries.length === 0) return
  const db = client ?? pool

  const valueRows: string[] = []
  const params: unknown[] = []
  let idx = 1

  for (const entry of entries) {
    valueRows.push(
      `($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4})`,
    )
    params.push(
      runId,
      entry.fixed_asset_id,
      entry.depreciation_amount,
      entry.accumulated_before,
      entry.accumulated_after,
    )
    idx += 5
  }

  await db.query(
    `INSERT INTO asset_depreciation_entries
       (depreciation_run_id, fixed_asset_id, depreciation_amount, accumulated_before, accumulated_after)
     VALUES ${valueRows.join(', ')}`,
    params,
  )
}

export async function updateRunJournals(
  runId: string,
  journalIds: string[],
  client?: PoolClient,
): Promise<void> {
  const db = client ?? pool
  await db.query(
    `UPDATE asset_depreciation_runs SET journal_ids = $1 WHERE id = $2`,
    [journalIds, runId],
  )
}

export async function findRuns(
  companyId: string,
  pagination: { limit: number; offset: number },
  filter?: { status?: string; fiscal_period_id?: string },
  client?: PoolClient,
): Promise<{ data: DepreciationRun[]; total: number }> {
  const db = client ?? pool
  const conditions = ['company_id = $1']
  const params: unknown[] = [companyId]
  let idx = 2

  if (filter?.status) {
    const trimmed = filter.status.trim()
    if (trimmed.includes(',')) {
      params.push(trimmed.split(',').map((s) => s.trim()))
      conditions.push(`status = ANY($${idx++}::text[])`)
    } else {
      params.push(trimmed)
      conditions.push(`status = $${idx++}`)
    }
  }
  if (filter?.fiscal_period_id) {
    params.push(filter.fiscal_period_id)
    conditions.push(`fiscal_period_id = $${idx++}`)
  }

  const where = `WHERE ${conditions.join(' AND ')}`
  const limitIdx = idx
  const offsetIdx = idx + 1
  params.push(pagination.limit, pagination.offset)

  const [dataRes, countRes] = await Promise.all([
    db.query<DepreciationRun>(
      `SELECT * FROM asset_depreciation_runs ${where}
       ORDER BY run_date DESC, created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params,
    ),
    db.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM asset_depreciation_runs ${where}`,
      params.slice(0, idx - 1),
    ),
  ])

  return { data: dataRes.rows, total: countRes.rows[0].total }
}

export async function findRunById(
  id: string,
  companyId: string,
  client?: PoolClient,
): Promise<DepreciationRun | null> {
  const db = client ?? pool
  const { rows } = await db.query<DepreciationRun>(
    `SELECT * FROM asset_depreciation_runs
     WHERE id = $1 AND company_id = $2`,
    [id, companyId],
  )
  return rows[0] ?? null
}

export async function findRunEntries(
  runId: string,
  client?: PoolClient,
): Promise<DepreciationEntry[]> {
  const db = client ?? pool
  const { rows } = await db.query<DepreciationEntry>(
    `SELECT * FROM asset_depreciation_entries
     WHERE depreciation_run_id = $1
     ORDER BY created_at ASC`,
    [runId],
  )
  return rows
}

// ─── Asset Movements ─────────────────────────────────────────────────────────

export async function createMovement(
  data: {
    company_id: string
    fixed_asset_id: string
    movement_type: MovementType
    movement_date: string
    from_value?: string | null
    to_value?: string | null
    reference_id?: string | null
    reference_type?: string | null
    notes?: string | null
    created_by?: string | null
  },
  client?: PoolClient,
): Promise<AssetMovement> {
  const db = client ?? pool
  const { rows } = await db.query<AssetMovement>(
    `INSERT INTO asset_movements
       (company_id, fixed_asset_id, movement_type, movement_date,
        from_value, to_value, reference_id, reference_type, notes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      data.company_id,
      data.fixed_asset_id,
      data.movement_type,
      data.movement_date,
      data.from_value ?? null,
      data.to_value ?? null,
      data.reference_id ?? null,
      data.reference_type ?? null,
      data.notes ?? null,
      data.created_by ?? null,
    ],
  )
  return rows[0]
}

export async function findMovementsByAsset(
  fixedAssetId: string,
  companyId: string,
  pagination: { limit: number; offset: number },
  filter?: { movement_type?: string },
  client?: PoolClient,
): Promise<{ data: AssetMovement[]; total: number }> {
  const db = client ?? pool
  const conditions = ['fixed_asset_id = $1', 'company_id = $2']
  const params: unknown[] = [fixedAssetId, companyId]
  let idx = 3

  if (filter?.movement_type) {
    const trimmed = filter.movement_type.trim()
    if (trimmed.includes(',')) {
      params.push(trimmed.split(',').map((s) => s.trim()))
      conditions.push(`movement_type = ANY($${idx++}::text[])`)
    } else {
      params.push(trimmed)
      conditions.push(`movement_type = $${idx++}`)
    }
  }

  const where = `WHERE ${conditions.join(' AND ')}`
  const limitIdx = idx
  const offsetIdx = idx + 1
  params.push(pagination.limit, pagination.offset)

  const [dataRes, countRes] = await Promise.all([
    db.query<AssetMovement>(
      `SELECT * FROM asset_movements ${where}
       ORDER BY movement_date DESC, created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params,
    ),
    db.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM asset_movements ${where}`,
      params.slice(0, idx - 1),
    ),
  ])

  return { data: dataRes.rows, total: countRes.rows[0].total }
}

/** Unpaginated — used by asset detail embed only */
export async function findAllMovementsByAsset(
  fixedAssetId: string,
  companyId: string,
  client?: PoolClient,
): Promise<AssetMovement[]> {
  const db = client ?? pool
  const { rows } = await db.query<AssetMovement>(
    `SELECT * FROM asset_movements
     WHERE fixed_asset_id = $1 AND company_id = $2
     ORDER BY movement_date DESC, created_at DESC`,
    [fixedAssetId, companyId],
  )
  return rows
}

// ─── Hard Delete Helpers (for depreciation run reversal) ─────────────────────

export async function deleteRunEntries(
  runId: string,
  client: PoolClient,
): Promise<void> {
  await client.query(
    `DELETE FROM asset_depreciation_entries WHERE depreciation_run_id = $1`,
    [runId],
  )
}

export async function deleteDepreciationMovements(
  runId: string,
  client: PoolClient,
): Promise<void> {
  await client.query(
    `DELETE FROM asset_movements
     WHERE reference_id = $1 AND reference_type = 'depreciation_run' AND movement_type = 'DEPRECIATION'`,
    [runId],
  )
}

export async function deleteRun(
  runId: string,
  client: PoolClient,
): Promise<void> {
  await client.query(
    `DELETE FROM asset_depreciation_runs WHERE id = $1`,
    [runId],
  )
}
