import type { PoolClient } from 'pg'
import * as repository from './fixed-assets.repository'
import {
  AssetCategoryNotFoundError,
  AssetCategoryInUseError,
  AssetCategoryDuplicateError,
  FixedAssetNotFoundError,
  BranchNotFoundError,
} from './fixed-assets.errors'
import { generateAssetCode } from './asset-code-generator.util'
import { generateQrCode, generateBulkQrPdf } from './qr-code.util'
import { isPostgresError } from '../../utils/postgres-error.util'
import { AuditService } from '../monitoring/monitoring.service'
import type {
  AssetCategory,
  FixedAsset,
  AssetMovement,
  CreateAssetFromGrDto,
} from './fixed-assets.types'

type PaginationMeta = {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

function buildPagination(page: number, limit: number, total: number): PaginationMeta {
  const totalPages = Math.ceil(total / limit)
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  }
}

// ─── Category CRUD ───────────────────────────────────────────────────────────

export async function getCategories(
  companyId: string,
  filters: {
    page: number
    limit: number
    search?: string
    is_active?: boolean
  },
): Promise<{ data: AssetCategory[]; pagination: PaginationMeta }> {
  const offset = (filters.page - 1) * filters.limit
  const { data, total } = await repository.findCategoriesPaginated(
    companyId,
    { limit: filters.limit, offset },
    { search: filters.search, is_active: filters.is_active },
  )
  return { data, pagination: buildPagination(filters.page, filters.limit, total) }
}

export async function getCategoryById(
  id: string,
  companyId: string,
): Promise<AssetCategory> {
  const category = await repository.findCategoryById(id, companyId)
  if (!category) throw new AssetCategoryNotFoundError(id)
  return category
}

export async function createCategory(
  data: {
    category_code: string
    category_name: string
    asset_coa_id: string
    depreciation_expense_coa_id: string
    accumulated_depreciation_coa_id: string
    default_useful_life_months: number
  },
  companyId: string,
  userId: string,
): Promise<AssetCategory> {
  // Uniqueness check: company + code
  const existing = await repository.findCategoryByCode(companyId, data.category_code)
  if (existing) throw new AssetCategoryDuplicateError(data.category_code)

  try {
    const category = await repository.createCategory({
      company_id: companyId,
      category_code: data.category_code,
      category_name: data.category_name,
      asset_coa_id: data.asset_coa_id,
      depreciation_expense_coa_id: data.depreciation_expense_coa_id,
      accumulated_depreciation_coa_id: data.accumulated_depreciation_coa_id,
      default_useful_life_months: data.default_useful_life_months,
      created_by: userId,
    })
    await AuditService.log('CREATE', 'asset_category', category.id, userId, undefined, category)
    return category
  } catch (err: unknown) {
    if (isPostgresError(err, '23505')) throw new AssetCategoryDuplicateError(data.category_code)
    throw err
  }
}

export async function updateCategory(
  id: string,
  data: {
    category_name?: string
    asset_coa_id?: string
    depreciation_expense_coa_id?: string
    accumulated_depreciation_coa_id?: string
    default_useful_life_months?: number
    is_active?: boolean
  },
  companyId: string,
  userId: string,
): Promise<AssetCategory> {
  const existing = await repository.findCategoryById(id, companyId)
  if (!existing) throw new AssetCategoryNotFoundError(id)

  const updated = await repository.updateCategory(id, companyId, {
    ...data,
    updated_by: userId,
  })
  if (!updated) throw new AssetCategoryNotFoundError(id)
  await AuditService.log('UPDATE', 'asset_category', id, userId, existing, updated)
  return updated
}

export async function deleteCategory(
  id: string,
  companyId: string,
  userId: string,
): Promise<void> {
  const existing = await repository.findCategoryById(id, companyId)
  if (!existing) throw new AssetCategoryNotFoundError(id)

  // In-use guard
  const inUse = await repository.isCategoryInUse(id, companyId)
  if (inUse) throw new AssetCategoryInUseError()

  await repository.softDeleteCategory(id, companyId, userId)
  await AuditService.log('DELETE', 'asset_category', id, userId, existing)
}

export async function restoreCategory(
  id: string,
  companyId: string,
  userId: string,
): Promise<AssetCategory> {
  const existing = await repository.findCategoryByIdIncludeDeleted(id, companyId)
  if (!existing) throw new AssetCategoryNotFoundError(id)
  if (!existing.deleted_at) throw new AssetCategoryNotFoundError(id)

  const restored = await repository.restoreCategory(id, companyId, userId)
  if (!restored) throw new AssetCategoryNotFoundError(id)

  await AuditService.log('RESTORE', 'asset_category', id, userId, existing, restored)
  return restored
}

// ─── Asset: Create from GR ───────────────────────────────────────────────────

export async function createFromGr(
  client: PoolClient,
  dto: CreateAssetFromGrDto,
): Promise<FixedAsset> {
  // Fetch category for defaults
  const category = await repository.findCategoryById(dto.asset_category_id, dto.company_id, client)
  if (!category) throw new AssetCategoryNotFoundError(dto.asset_category_id)

  // Get branch code for asset code generation
  const branchCode = await repository.findBranchCode(dto.branch_id, client)
  if (!branchCode) {
    throw new BranchNotFoundError(dto.branch_id)
  }

  // Generate unique asset code
  const assetCode = await generateAssetCode(
    client,
    dto.company_id,
    category.category_code,
    branchCode,
  )

  // Create the asset record
  const asset = await repository.createAsset(
    {
      company_id: dto.company_id,
      branch_id: dto.branch_id,
      asset_code: assetCode,
      asset_name: dto.asset_name,
      asset_category_id: dto.asset_category_id,
      product_id: dto.product_id,
      status: 'DRAFT',
      acquisition_date: dto.acquisition_date,
      cost: dto.cost,
      salvage_value: 0,
      useful_life_months: dto.useful_life_months ?? category.default_useful_life_months,
      depreciation_method: 'STRAIGHT_LINE',
      gr_line_id: dto.gr_line_id,
      created_by: dto.created_by,
    },
    client,
  )

  // Generate QR code and update
  const qrCodeUrl = await generateQrCode(asset.id)
  await repository.updateQrCode(asset.id, qrCodeUrl, client)

  return { ...asset, qr_code_url: qrCodeUrl }
}

// ─── Asset List / Detail ─────────────────────────────────────────────────────

export async function getAssets(
  companyId: string,
  filters: {
    page: number
    limit: number
    branch_id?: string
    status?: string
    asset_category_id?: string
    search?: string
    date_from?: string
    date_to?: string
  },
): Promise<{ data: FixedAsset[]; pagination: PaginationMeta }> {
  const offset = (filters.page - 1) * filters.limit
  const { data, total } = await repository.findAssets(
    companyId,
    { limit: filters.limit, offset },
    {
      branch_id: filters.branch_id,
      status: filters.status,
      asset_category_id: filters.asset_category_id,
      search: filters.search,
      date_from: filters.date_from,
      date_to: filters.date_to,
    },
  )

  return { data, pagination: buildPagination(filters.page, filters.limit, total) }
}

export async function getAssetById(
  id: string,
  companyId: string,
): Promise<FixedAsset & { movements: AssetMovement[] }> {
  const asset = await repository.findById(id, companyId)
  if (!asset) throw new FixedAssetNotFoundError(id)

  const movements = await repository.findAllMovementsByAsset(id, companyId)
  return { ...asset, movements }
}

export async function updateAsset(
  id: string,
  data: {
    asset_name?: string
    description?: string | null
    serial_number?: string | null
    location_note?: string | null
    photo_url?: string | null
    salvage_value?: number
    useful_life_months?: number
  },
  companyId: string,
  userId: string,
): Promise<FixedAsset> {
  const existing = await repository.findById(id, companyId)
  if (!existing) throw new FixedAssetNotFoundError(id)

  const updated = await repository.updateAssetMetadata(id, companyId, {
    ...data,
    updated_by: userId,
  })
  if (!updated) throw new FixedAssetNotFoundError(id)
  await AuditService.log('UPDATE', 'fixed_asset', id, userId, existing, updated)
  return updated
}

// ─── Movements / QR ──────────────────────────────────────────────────────────

export async function getMovements(
  assetId: string,
  companyId: string,
  filters: {
    page: number
    limit: number
    movement_type?: string
  },
): Promise<{ data: AssetMovement[]; pagination: PaginationMeta }> {
  const asset = await repository.findById(assetId, companyId)
  if (!asset) throw new FixedAssetNotFoundError(assetId)

  const offset = (filters.page - 1) * filters.limit
  const { data, total } = await repository.findMovementsByAsset(
    assetId,
    companyId,
    { limit: filters.limit, offset },
    { movement_type: filters.movement_type },
  )
  return { data, pagination: buildPagination(filters.page, filters.limit, total) }
}

export async function regenerateQrCode(
  id: string,
  companyId: string,
  userId: string,
): Promise<{ id: string; qr_code_url: string }> {
  const asset = await repository.findById(id, companyId)
  if (!asset) throw new FixedAssetNotFoundError(id)

  const qrCodeUrl = await generateQrCode(id)
  await repository.updateQrCode(id, qrCodeUrl)
  await AuditService.log('UPDATE', 'fixed_asset', id, userId, { qr_code_url: asset.qr_code_url }, { qr_code_url: qrCodeUrl })
  return { id, qr_code_url: qrCodeUrl }
}

export async function bulkQrPdf(
  assetIds: string[],
  companyId: string,
): Promise<{ assets: Array<{ id: string; asset_code: string }>; pdf: Buffer }> {
  const found = await repository.findByIds(assetIds, companyId)
  if (found.length === 0) throw new FixedAssetNotFoundError()

  const assets = found.map((a) => ({ id: a.id, asset_code: a.asset_code }))
  const pdf = await generateBulkQrPdf(assets)
  return { assets, pdf }
}

// ─── List helpers (transfers, maintenance, disposals, depreciation) ──────────

export async function listTransfers(
  companyId: string,
  filters: {
    page: number
    limit: number
    fixed_asset_id?: string
    branch_id?: string
    date_from?: string
    date_to?: string
  },
) {
  const offset = (filters.page - 1) * filters.limit
  const { data, total } = await repository.findTransfers(
    companyId,
    { limit: filters.limit, offset },
    {
      fixed_asset_id: filters.fixed_asset_id,
      branch_id: filters.branch_id,
      date_from: filters.date_from,
      date_to: filters.date_to,
    },
  )
  return { data, pagination: buildPagination(filters.page, filters.limit, total) }
}

export async function listMaintenance(
  companyId: string,
  filters: {
    page: number
    limit: number
    fixed_asset_id?: string
    status?: string
    search?: string
    date_from?: string
    date_to?: string
  },
) {
  const offset = (filters.page - 1) * filters.limit
  const { data, total } = await repository.findMaintenance(
    companyId,
    { limit: filters.limit, offset },
    {
      fixed_asset_id: filters.fixed_asset_id,
      status: filters.status,
      search: filters.search,
      date_from: filters.date_from,
      date_to: filters.date_to,
    },
  )
  return { data, pagination: buildPagination(filters.page, filters.limit, total) }
}

export async function listDisposals(
  companyId: string,
  filters: {
    page: number
    limit: number
    fixed_asset_id?: string
    status?: string
    disposal_method?: string
    date_from?: string
    date_to?: string
  },
) {
  const offset = (filters.page - 1) * filters.limit
  const { data, total } = await repository.findDisposals(
    companyId,
    { limit: filters.limit, offset },
    {
      fixed_asset_id: filters.fixed_asset_id,
      status: filters.status,
      disposal_method: filters.disposal_method,
      date_from: filters.date_from,
      date_to: filters.date_to,
    },
  )
  return { data, pagination: buildPagination(filters.page, filters.limit, total) }
}

export async function listDepreciationRuns(
  companyId: string,
  filters: {
    page: number
    limit: number
    status?: string
    fiscal_period_id?: string
  },
) {
  const offset = (filters.page - 1) * filters.limit
  const { data, total } = await repository.findRuns(
    companyId,
    { limit: filters.limit, offset },
    { status: filters.status, fiscal_period_id: filters.fiscal_period_id },
  )
  return { data, pagination: buildPagination(filters.page, filters.limit, total) }
}
