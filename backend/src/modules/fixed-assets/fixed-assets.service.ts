import type { PoolClient } from 'pg'
import { pool } from '../../config/db'
import * as repository from './fixed-assets.repository'
import { journalHeadersService } from '../accounting/journals/journal-headers/journal-headers.service'
import type { CreateJournalLineDto } from '../accounting/journals/journal-headers/journal-headers.types'
import {
  AssetCategoryNotFoundError,
  AssetCategoryInUseError,
  AssetCategoryDuplicateError,
  FixedAssetNotFoundError,
  BranchNotFoundError,
  AssetAlreadyActiveError,
} from './fixed-assets.errors'
import { generateAssetCode } from './asset-code-generator.util'
import { generateQrCode, generateBulkQrPdf } from './qr-code.util'
import { isPostgresError } from '../../utils/postgres-error.util'
import { AuditService } from '../monitoring/monitoring.service'
import { logError } from '../../config/logger'
import { storageService } from '../../services/storage.service'
import { resolveDocumentUploadExtension } from '../../utils/document-upload.util'
import type {
  AssetCategory,
  FixedAsset,
  AssetMovement,
  CreateAssetFromGrDto,
} from './fixed-assets.types'

// ─── Constants ───────────────────────────────────────────────────────────────
const ASSET_PHOTOS_BUCKET = 'asset-photos'
const PHOTO_SIGNED_URL_EXPIRY = 900 // 15 minutes

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

  const enriched = await Promise.all(
    data.map(async (asset) => ({
      ...asset,
      thumbnail_url: asset.thumbnail_path
        ? await storageService.createSignedUrl(asset.thumbnail_path, PHOTO_SIGNED_URL_EXPIRY, ASSET_PHOTOS_BUCKET)
        : null,
    })),
  )

  return { data: enriched, pagination: buildPagination(filters.page, filters.limit, total) }
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

// ─── Manual Activation (DRAFT → ACTIVE) ────────────────────────────────────

export async function activateAsset(
  id: string,
  companyId: string,
  userId: string,
  capitalizedDate?: string,
): Promise<FixedAsset> {
  const existing = await repository.findById(id, companyId)
  if (!existing) throw new FixedAssetNotFoundError(id)
  if (existing.status !== 'DRAFT') throw new AssetAlreadyActiveError(existing.asset_code)

  const date = capitalizedDate ?? new Date().toISOString().split('T')[0]

  await repository.activateAsset(id, companyId, { capitalized_date: date, updated_by: userId })
  await repository.createMovement({
    company_id: companyId,
    fixed_asset_id: id,
    movement_type: 'CAPITALIZE',
    movement_date: date,
    from_value: 'DRAFT',
    to_value: 'ACTIVE',
    notes: 'Manual activation without invoice',
    created_by: userId,
  })
  await AuditService.log(
    'UPDATE',
    'fixed_asset',
    id,
    userId,
    { status: 'DRAFT' },
    { status: 'ACTIVE', capitalized_date: date },
  )

  const asset = await repository.findById(id, companyId)
  if (!asset) throw new FixedAssetNotFoundError(id)
  return asset
}

// ─── Marketplace Auto-Capitalize ─────────────────────────────────────────────

export interface MarketplaceCapitalizeWorkItem {
  asset: FixedAsset
  categoryAssetCoaId: string
}

/**
 * Phase 1: Activate assets + create movements (runs INSIDE GR transaction).
 * Returns work items for Phase 2 journal creation.
 */
export async function capitalizeMarketplaceAssets(
  client: PoolClient,
  companyId: string,
  grLineIds: string[],
  capitalizedDate: string,
  userId: string,
): Promise<MarketplaceCapitalizeWorkItem[]> {
  if (grLineIds.length === 0) return []

  const { rows: draftAssets } = await client.query<FixedAsset>(
    `SELECT * FROM fixed_assets
     WHERE gr_line_id = ANY($1::uuid[])
       AND company_id = $2
       AND status = 'DRAFT'
       AND deleted_at IS NULL`,
    [grLineIds, companyId],
  )

  const workItems: MarketplaceCapitalizeWorkItem[] = []

  for (const asset of draftAssets) {
    const category = await repository.findCategoryById(asset.asset_category_id, companyId, client)
    if (!category) {
      throw new AssetCategoryNotFoundError(asset.asset_category_id)
    }

    await repository.activateAsset(
      asset.id,
      companyId,
      { capitalized_date: capitalizedDate, updated_by: userId },
      client,
    )

    await repository.createMovement(
      {
        company_id: companyId,
        fixed_asset_id: asset.id,
        movement_type: 'CAPITALIZE',
        movement_date: capitalizedDate,
        from_value: 'DRAFT',
        to_value: 'ACTIVE',
        reference_id: asset.gr_line_id,
        reference_type: 'goods_receipt',
        notes: 'Auto-capitalize from marketplace GR',
        created_by: userId,
      },
      client,
    )

    workItems.push({ asset, categoryAssetCoaId: category.asset_coa_id })
  }

  return workItems
}

/**
 * Phase 2: Create & post capitalization journals for marketplace assets.
 * Runs AFTER the GR transaction commits. On failure, reverts assets back to DRAFT.
 */
export async function postMarketplaceCapitalizationJournals(
  workItems: MarketplaceCapitalizeWorkItem[],
  companyId: string,
  ccCoaId: string,
  capitalizedDate: string,
  userId: string,
): Promise<void> {
  if (workItems.length === 0) return

  const journalPosted: MarketplaceCapitalizeWorkItem[] = []

  try {
    for (const item of workItems) {
      const lines: CreateJournalLineDto[] = [
        {
          line_number: 1,
          account_id: item.categoryAssetCoaId,
          description: item.asset.asset_name,
          debit_amount: item.asset.cost,
          credit_amount: 0,
        },
        {
          line_number: 2,
          account_id: ccCoaId,
          description: 'Kartu Kredit Marketplace',
          debit_amount: 0,
          credit_amount: item.asset.cost,
        },
      ]

      const journal = await journalHeadersService.create(
        {
          company_id: companyId,
          branch_id: item.asset.branch_id,
          journal_date: capitalizedDate,
          journal_type: 'ASSET',
          source_module: 'fixed_assets',
          reference_type: 'fixed_asset',
          reference_id: item.asset.id,
          reference_number: item.asset.asset_code,
          description: `Kapitalisasi Aset Marketplace ${item.asset.asset_code} - ${item.asset.asset_name}`,
          currency: 'IDR',
          exchange_rate: 1,
          lines,
        },
        userId,
      )

      await journalHeadersService.submitAsUser(journal.id, userId)
      await journalHeadersService.approveAsUser(journal.id, userId)
      await journalHeadersService.postAsUser(journal.id, userId)

      await repository.updateJournalId(item.asset.id, journal.id)
      journalPosted.push(item)

      await AuditService.log(
        'UPDATE',
        'fixed_asset',
        item.asset.id,
        userId,
        { status: 'DRAFT' },
        { status: 'ACTIVE', capitalized_date: capitalizedDate, journal_id: journal.id },
      )
    }
  } catch (e) {
    // Revert only assets that did NOT get a successfully posted journal
    const revertClient = await pool.connect()
    try {
      await revertClient.query('BEGIN')
      const postedIds = new Set(journalPosted.map((p) => p.asset.id))
      for (const item of workItems) {
        if (postedIds.has(item.asset.id)) continue // has journal, don't revert
        await repository.revertCapitalization(
          item.asset.id,
          companyId,
          { cost: item.asset.cost, updated_by: userId },
          revertClient,
        )
      }
      await revertClient.query('COMMIT')
    } catch (revErr: unknown) {
      await revertClient.query('ROLLBACK')
      logError('Failed to revert marketplace asset capitalization after journal error', {
        company_id: companyId,
        error: revErr instanceof Error ? revErr.message : revErr,
      })
    } finally {
      revertClient.release()
    }
    throw e
  }
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

// ─── Asset Photos ────────────────────────────────────────────────────────────

const MAX_PHOTOS_PER_ASSET = 5

export async function listPhotos(assetId: string, companyId: string) {
  const asset = await repository.findById(assetId, companyId)
  if (!asset) throw new FixedAssetNotFoundError(assetId)

  const photos = await repository.listAssetPhotos(assetId, companyId)
  const withUrls = await Promise.all(
    photos.map(async (p) => ({
      ...p,
      url: await storageService.createSignedUrl(p.file_path, PHOTO_SIGNED_URL_EXPIRY, ASSET_PHOTOS_BUCKET),
    })),
  )
  return withUrls
}

export async function uploadPhoto(
  assetId: string,
  companyId: string,
  userId: string,
  file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
) {
  const asset = await repository.findById(assetId, companyId)
  if (!asset) throw new FixedAssetNotFoundError(assetId)

  const count = await repository.countAssetPhotos(assetId, companyId)
  if (count >= MAX_PHOTOS_PER_ASSET) {
    throw new Error(`Maksimal ${MAX_PHOTOS_PER_ASSET} foto per aset. Hapus foto lama terlebih dahulu.`)
  }

  const ext = resolveDocumentUploadExtension(file)
  if (!ext) {
    throw new Error('Format file tidak didukung. Gunakan JPG, PNG, WEBP, atau HEIC.')
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error('File terlalu besar. Maksimal 10MB.')
  }

  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const path = `${companyId}/${assetId}/${fileName}`

  await storageService.uploadToPath(file.buffer, path, file.mimetype, ASSET_PHOTOS_BUCKET)

  const photo = await repository.insertAssetPhoto({
    fixed_asset_id: assetId,
    company_id: companyId,
    file_path: path,
    file_name: file.originalname,
    file_size: file.size,
    sort_order: count,
    uploaded_by: userId,
  })

  return {
    ...photo,
    url: await storageService.createSignedUrl(photo.file_path, PHOTO_SIGNED_URL_EXPIRY, ASSET_PHOTOS_BUCKET),
  }
}

export async function deletePhoto(
  assetId: string,
  photoId: string,
  companyId: string,
  userId: string,
) {
  const asset = await repository.findById(assetId, companyId)
  if (!asset) throw new FixedAssetNotFoundError(assetId)

  const deleted = await repository.deleteAssetPhoto(photoId, assetId, companyId)
  if (!deleted) throw new Error('Foto tidak ditemukan')

  // Delete from R2
  try {
    await storageService.delete(deleted.file_path, ASSET_PHOTOS_BUCKET)
  } catch (e) {
    logError('Failed to delete asset photo from R2', {
      photo_id: photoId,
      file_path: deleted.file_path,
      error: e instanceof Error ? e.message : e,
    })
  }

  await AuditService.log('DELETE', 'asset_photo', photoId, userId, {
    fixed_asset_id: assetId,
    file_path: deleted.file_path,
  })

  return deleted
}
