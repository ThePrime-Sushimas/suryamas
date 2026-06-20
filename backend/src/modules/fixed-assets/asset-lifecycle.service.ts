import { pool } from '../../config/db'
import { journalHeadersService } from '../accounting/journals/journal-headers/journal-headers.service'
import { chartOfAccountsRepository } from '../accounting/chart-of-accounts/chart-of-accounts.repository'
import type { CreateJournalLineDto } from '../accounting/journals/journal-headers/journal-headers.types'
import * as repository from './fixed-assets.repository'
import {
  AssetNotActiveError,
  CrossCompanyTransferError,
  DisposalInvalidStatusError,
  FixedAssetNotFoundError,
  AssetCategoryNotFoundError,
  MaintenanceNotFoundError,
  MaintenanceInvalidStatusError,
  DisposalNotFoundError,
  DisposalAlreadyPostedError,
  CoaNotFoundError,
} from './fixed-assets.errors'
import type {
  CreateTransferDto,
  CreateMaintenanceDto,
  CreateDisposalDto,
  AssetDisposal,
  FixedAsset,
} from './fixed-assets.types'
import { logInfo, logError } from '../../config/logger'
import { AuditService } from '../monitoring/monitoring.service'

// ─── COA Code Constants ──────────────────────────────────────────────────────

const ACCOUNTS_PAYABLE_COA_CODE = '210101'
const GAIN_ON_DISPOSAL_COA_CODE = '710101' // Laba/Rugi Penjualan Aset / Revaluasi
const LOSS_ON_DISPOSAL_COA_CODE = '710101' // sama — satu akun untuk laba & rugi
const CASH_RECEIVABLE_COA_CODE = '110201'
const INTER_BRANCH_TRANSFER_COA_CODE = '110598' // Persediaan/Aset Transit (shared with stock transfers)

// ─── Helper: Resolve COA ID by code ──────────────────────────────────────────

async function resolveCoaId(companyId: string, coaCode: string): Promise<string> {
  const coa = await chartOfAccountsRepository.findByCode(companyId, coaCode)
  if (!coa) throw new CoaNotFoundError(coaCode)
  return coa.id
}

// ─── Helper: Auto-post journal (create → submit → approve → post) ────────────

async function createAndPostJournal(
  params: {
    company_id: string
    branch_id?: string
    journal_date: string
    source_module: string
    reference_type: string
    reference_id?: string
    reference_number?: string
    description: string
    lines: CreateJournalLineDto[]
  },
  userId: string,
): Promise<string> {
  const journal = await journalHeadersService.create(
    {
      company_id: params.company_id,
      branch_id: params.branch_id,
      journal_date: params.journal_date,
      journal_type: 'ASSET',
      source_module: params.source_module,
      reference_type: params.reference_type,
      reference_id: params.reference_id,
      reference_number: params.reference_number,
      description: params.description,
      currency: 'IDR',
      exchange_rate: 1,
      lines: params.lines,
    },
    userId,
  )

  await journalHeadersService.submitAsUser(journal.id, userId)
  await journalHeadersService.approveAsUser(journal.id, userId)
  await journalHeadersService.postAsUser(journal.id, userId)

  return journal.id
}

// ─── 1. Capitalization from Invoice ──────────────────────────────────────────

interface CapitalizeWorkItem {
  asset: FixedAsset
  unitCost: number
  categoryAssetCoaId: string
  originalCost: number
}

/**
 * Called after Purchase Invoice is posted (outside PI transaction).
 * Phase 1: update assets + movements in a DB transaction.
 * Phase 2: post capitalization journals; revert asset state if journal posting fails.
 */
export async function capitalizeAssetsFromInvoice(
  invoiceId: string,
  invoiceDate: string,
  userId: string,
): Promise<void> {
  const readClient = await pool.connect()
  let workItems: CapitalizeWorkItem[]

  try {
    const { rows: assetLines } = await readClient.query<{
      gr_line_id: string
      product_id: string
      product_name: string
      unit_price: number
    }>(
      `SELECT pil.gr_line_id, pil.product_id, p.product_name, pil.unit_price
       FROM purchase_invoice_lines pil
       JOIN products p ON p.id = pil.product_id
       WHERE pil.purchase_invoice_id = $1
         AND pil.deleted_at IS NULL
         AND EXISTS (
           SELECT 1 FROM fixed_assets fa
           WHERE fa.gr_line_id = pil.gr_line_id AND fa.deleted_at IS NULL
         )`,
      [invoiceId],
    )

    workItems = []

    for (const line of assetLines) {
      const { rows: draftAssets } = await readClient.query<FixedAsset>(
        `SELECT * FROM fixed_assets
         WHERE gr_line_id = $1 AND status = 'DRAFT' AND deleted_at IS NULL`,
        [line.gr_line_id],
      )

      for (const asset of draftAssets) {
        const category = await repository.findCategoryById(asset.asset_category_id, asset.company_id, readClient)
        if (!category) continue

        workItems.push({
          asset,
          unitCost: line.unit_price,
          categoryAssetCoaId: category.asset_coa_id,
          originalCost: asset.cost,
        })
      }
    }
  } finally {
    readClient.release()
  }

  if (workItems.length === 0) return

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    for (const item of workItems) {
      await repository.capitalize(
        item.asset.id,
        item.asset.company_id,
        {
          cost: item.unitCost,
          capitalized_date: invoiceDate,
          purchase_invoice_id: invoiceId,
          status: 'ACTIVE',
          updated_by: userId,
        },
        client,
      )

      await repository.createMovement(
        {
          company_id: item.asset.company_id,
          fixed_asset_id: item.asset.id,
          movement_type: 'CAPITALIZE',
          movement_date: invoiceDate,
          from_value: 'DRAFT',
          to_value: 'ACTIVE',
          reference_id: invoiceId,
          reference_type: 'purchase_invoice',
          notes: `Cost: ${item.unitCost}`,
          created_by: userId,
        },
        client,
      )
    }

    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }

  const apCoaIdByCompany = new Map<string, string>()
  const journalPosted: CapitalizeWorkItem[] = []

  try {
    for (const item of workItems) {
      let apCoaId = apCoaIdByCompany.get(item.asset.company_id)
      if (!apCoaId) {
        apCoaId = await resolveCoaId(item.asset.company_id, ACCOUNTS_PAYABLE_COA_CODE)
        apCoaIdByCompany.set(item.asset.company_id, apCoaId)
      }

      const journalId = await createAndPostJournal(
        {
          company_id: item.asset.company_id,
          branch_id: item.asset.branch_id,
          journal_date: invoiceDate,
          source_module: 'fixed_assets',
          reference_type: 'fixed_asset',
          reference_id: item.asset.id,
          reference_number: item.asset.asset_code,
          description: `Kapitalisasi Aset ${item.asset.asset_code} - ${item.asset.asset_name}`,
          lines: [
            {
              line_number: 1,
              account_id: item.categoryAssetCoaId,
              description: item.asset.asset_name,
              debit_amount: item.unitCost,
              credit_amount: 0,
            },
            {
              line_number: 2,
              account_id: apCoaId,
              description: 'Hutang Dagang',
              debit_amount: 0,
              credit_amount: item.unitCost,
            },
          ],
        },
        userId,
      )

      await repository.updateJournalId(item.asset.id, journalId)
      journalPosted.push(item)

      await AuditService.log(
        'UPDATE',
        'fixed_asset',
        item.asset.id,
        userId,
        { status: 'DRAFT' },
        { status: 'ACTIVE', journal_id: journalId, cost: item.unitCost },
      )
    }
  } catch (e) {
    const revertClient = await pool.connect()
    try {
      await revertClient.query('BEGIN')
      for (const item of journalPosted) {
        await repository.revertCapitalization(
          item.asset.id,
          item.asset.company_id,
          { cost: item.originalCost, updated_by: userId },
          revertClient,
        )
      }
      for (const item of workItems) {
        if (journalPosted.some((p) => p.asset.id === item.asset.id)) continue
        await repository.revertCapitalization(
          item.asset.id,
          item.asset.company_id,
          { cost: item.originalCost, updated_by: userId },
          revertClient,
        )
      }
      await revertClient.query('COMMIT')
    } catch (revErr: unknown) {
      await revertClient.query('ROLLBACK')
      logError('Failed to revert asset capitalization after journal error', {
        invoice_id: invoiceId,
        error: revErr instanceof Error ? revErr.message : revErr,
      })
    } finally {
      revertClient.release()
    }
    throw e
  }

  logInfo('Assets capitalized from invoice', { invoice_id: invoiceId, user_id: userId, count: workItems.length })
}

// ─── 2. Transfer Asset ───────────────────────────────────────────────────────

/**
 * Transfer asset between branches within the same company.
 * - Validates asset is ACTIVE
 * - Validates source and destination branches belong to same company
 * - Updates branch_id on asset
 * - Records TRANSFER movement
 * - Creates inter-branch transfer journals (move asset value between branches)
 */
export async function transferAsset(
  dto: CreateTransferDto,
  companyId: string,
  userId: string,
): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Find and validate asset
    const asset = await repository.findById(dto.fixed_asset_id, companyId, client)
    if (!asset) throw new FixedAssetNotFoundError(dto.fixed_asset_id)
    if (asset.status !== 'ACTIVE') {
      throw new AssetNotActiveError(asset.asset_code, asset.status)
    }

    // Validate destination branch belongs to same company
    const { rows: destBranch } = await client.query<{ company_id: string }>(
      `SELECT company_id FROM branches WHERE id = $1`,
      [dto.destination_branch_id],
    )
    if (!destBranch[0] || destBranch[0].company_id !== companyId) {
      throw new CrossCompanyTransferError()
    }

    const sourceBranchId = asset.branch_id
    const transferDate = dto.transfer_date || new Date().toISOString().split('T')[0]

    // Update branch_id on asset
    await repository.updateBranchId(asset.id, dto.destination_branch_id, userId, client)

    // Create transfer record
    const transfer = await repository.createTransfer(
      {
        company_id: companyId,
        fixed_asset_id: asset.id,
        transfer_date: transferDate,
        source_branch_id: sourceBranchId,
        destination_branch_id: dto.destination_branch_id,
        reason: dto.reason ?? null,
        transferred_by: userId,
        created_by: userId,
      },
      client,
    )

    // Record TRANSFER movement
    await repository.createMovement(
      {
        company_id: companyId,
        fixed_asset_id: asset.id,
        movement_type: 'TRANSFER',
        movement_date: transferDate,
        from_value: sourceBranchId,
        to_value: dto.destination_branch_id,
        reference_type: 'asset_transfer',
        notes: dto.reason ?? null,
        created_by: userId,
      },
      client,
    )

    await client.query('COMMIT')

    // ─── Post inter-branch transfer journals ─────────────────────────────────
    // Source branch: remove asset (Debit Accum Depr + Transit, Credit Fixed Asset at cost)
    // Dest branch: add asset (Debit Fixed Asset at cost, Credit Accum Depr + Transit)
    // This moves both the gross asset and accumulated depreciation between branches.
    try {
      const { sourceJournalId, targetJournalId } = await postTransferJournals(
        companyId, asset, sourceBranchId, dto.destination_branch_id, transferDate, userId,
      )
      // Mark transfer as journal-posted
      try {
        await repository.markTransferJournalPosted(transfer.id, sourceJournalId, targetJournalId)
      } catch (flagErr: unknown) {
        logError('Journal posted but failed to update flag (manual fix needed)', {
          transfer_id: transfer.id,
          source_journal_id: sourceJournalId,
          target_journal_id: targetJournalId,
          error: flagErr instanceof Error ? flagErr.message : flagErr,
        })
      }
    } catch (journalErr: unknown) {
      logError('Failed to post inter-branch transfer journals (asset moved but no journal)', {
        asset_id: asset.id,
        transfer_id: transfer.id,
        from_branch: sourceBranchId,
        to_branch: dto.destination_branch_id,
        error: journalErr instanceof Error ? journalErr.message : journalErr,
      })
    }

    await AuditService.log('UPDATE', 'fixed_asset', asset.id, userId, { branch_id: sourceBranchId }, { branch_id: dto.destination_branch_id })

    logInfo('Asset transferred', {
      asset_id: asset.id,
      from_branch: sourceBranchId,
      to_branch: dto.destination_branch_id,
      user_id: userId,
    })
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}

// ─── Transfer Journal Helper ─────────────────────────────────────────────────

/**
 * Post paired inter-branch transfer journals for a fixed asset.
 *
 * Source branch journal (removes asset from source):
 *   Dr Accumulated Depreciation COA (accumulated_depreciation)
 *   Dr Inter-branch Transit COA (book value = cost - accum_depr)
 *   Cr Fixed Asset COA (cost)
 *
 * Destination branch journal (adds asset to destination):
 *   Dr Fixed Asset COA (cost)
 *   Cr Accumulated Depreciation COA (accumulated_depreciation)
 *   Cr Inter-branch Transit COA (book value)
 *
 * Both journals balance. The transit account nets to zero company-wide.
 */
async function postTransferJournals(
  companyId: string,
  asset: FixedAsset,
  sourceBranchId: string,
  destBranchId: string,
  transferDate: string,
  userId: string,
): Promise<{ sourceJournalId: string; targetJournalId: string }> {
  // Resolve category for COA accounts
  const categories = await repository.findCategoriesByIds([asset.asset_category_id], companyId)
  const category = categories[0]
  if (!category) throw new AssetCategoryNotFoundError(asset.asset_category_id)

  const assetCoaId = category.asset_coa_id
  const accumDeprCoaId = category.accumulated_depreciation_coa_id
  const transitCoaId = await resolveCoaId(companyId, INTER_BRANCH_TRANSFER_COA_CODE)

  const cost = Math.round(asset.cost * 10000) / 10000
  const accumDepr = Math.round(asset.accumulated_depreciation * 10000) / 10000
  const bookValue = Math.round((asset.cost - asset.accumulated_depreciation) * 10000) / 10000

  // Guard: negative book value indicates data anomaly
  if (bookValue < 0) {
    throw new Error(
      `Cannot transfer asset ${asset.asset_code}: negative book value (cost=${cost}, accum_depr=${accumDepr}). Fix data before transferring.`,
    )
  }

  // Guard: fully depreciated asset (book value = 0) — only transfer gross asset & accum depr
  // Transit line is skipped since there's no net book value to move
  const includeTransitLine = bookValue > 0

  // Journal 1 — Source branch: remove asset
  const sourceLines: CreateJournalLineDto[] = []
  let lineNum = 1

  if (accumDepr > 0) {
    sourceLines.push({
      line_number: lineNum++,
      account_id: accumDeprCoaId,
      description: `Transfer keluar akum. penyusutan - ${asset.asset_code}`,
      debit_amount: accumDepr,
      credit_amount: 0,
    })
  }
  if (includeTransitLine) {
    sourceLines.push({
      line_number: lineNum++,
      account_id: transitCoaId,
      description: `Transfer keluar aset tetap (nilai buku) - ${asset.asset_code}`,
      debit_amount: bookValue,
      credit_amount: 0,
    })
  }
  sourceLines.push({
    line_number: lineNum++,
    account_id: assetCoaId,
    description: `Transfer keluar aset tetap - ${asset.asset_code}`,
    debit_amount: 0,
    credit_amount: cost,
  })

  const sourceJournal = await journalHeadersService.create(
    {
      company_id: companyId,
      branch_id: sourceBranchId,
      journal_date: transferDate,
      journal_type: 'ASSET',
      source_module: 'fixed_assets',
      reference_type: 'asset_transfer',
      reference_id: asset.id,
      reference_number: asset.asset_code,
      description: `Transfer keluar aset ${asset.asset_code} - ${asset.asset_name}`,
      currency: 'IDR',
      exchange_rate: 1,
      lines: sourceLines,
    },
    userId,
  )

  await journalHeadersService.submitAsUser(sourceJournal.id, userId)
  await journalHeadersService.approveAsUser(sourceJournal.id, userId)
  await journalHeadersService.postAsUser(sourceJournal.id, userId)

  // Journal 2 — Destination branch: add asset
  const destLines: CreateJournalLineDto[] = []
  lineNum = 1

  destLines.push({
    line_number: lineNum++,
    account_id: assetCoaId,
    description: `Transfer masuk aset tetap - ${asset.asset_code}`,
    debit_amount: cost,
    credit_amount: 0,
  })

  if (accumDepr > 0) {
    destLines.push({
      line_number: lineNum++,
      account_id: accumDeprCoaId,
      description: `Transfer masuk akum. penyusutan - ${asset.asset_code}`,
      debit_amount: 0,
      credit_amount: accumDepr,
    })
  }
  if (includeTransitLine) {
    destLines.push({
      line_number: lineNum++,
      account_id: transitCoaId,
      description: `Transfer masuk aset tetap (nilai buku) - ${asset.asset_code}`,
      debit_amount: 0,
      credit_amount: bookValue,
    })
  }

  const destJournal = await journalHeadersService.create(
    {
      company_id: companyId,
      branch_id: destBranchId,
      journal_date: transferDate,
      journal_type: 'ASSET',
      source_module: 'fixed_assets',
      reference_type: 'asset_transfer',
      reference_id: asset.id,
      reference_number: asset.asset_code,
      description: `Transfer masuk aset ${asset.asset_code} - ${asset.asset_name}`,
      currency: 'IDR',
      exchange_rate: 1,
      lines: destLines,
    },
    userId,
  )

  await journalHeadersService.submitAsUser(destJournal.id, userId)
  await journalHeadersService.approveAsUser(destJournal.id, userId)
  await journalHeadersService.postAsUser(destJournal.id, userId)

  logInfo('Inter-branch transfer journals posted', {
    asset_id: asset.id,
    source_journal_id: sourceJournal.id,
    target_journal_id: destJournal.id,
  })

  return { sourceJournalId: sourceJournal.id, targetJournalId: destJournal.id }
}

// ─── 3. Record Maintenance ───────────────────────────────────────────────────

/**
 * Record maintenance on an active asset.
 * - Validates asset is ACTIVE
 * - Sets asset status to MAINTENANCE
 * - Creates maintenance record
 * - Records MAINTENANCE movement
 */
export async function recordMaintenance(
  dto: CreateMaintenanceDto,
  companyId: string,
  userId: string,
): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Find and validate asset
    const asset = await repository.findById(dto.fixed_asset_id, companyId, client)
    if (!asset) throw new FixedAssetNotFoundError(dto.fixed_asset_id)
    if (asset.status !== 'ACTIVE') {
      throw new AssetNotActiveError(asset.asset_code, asset.status)
    }

    // Set asset status to MAINTENANCE
    await repository.updateStatus(asset.id, 'MAINTENANCE', userId, client)

    // Create maintenance record
    const maintenance = await repository.createMaintenance(
      {
        company_id: companyId,
        fixed_asset_id: asset.id,
        maintenance_date: dto.maintenance_date,
        description: dto.description,
        vendor_id: dto.vendor_id,
        created_by: userId,
      },
      client,
    )

    // Record MAINTENANCE movement
    await repository.createMovement(
      {
        company_id: companyId,
        fixed_asset_id: asset.id,
        movement_type: 'MAINTENANCE',
        movement_date: dto.maintenance_date,
        from_value: 'ACTIVE',
        to_value: 'MAINTENANCE',
        reference_id: maintenance.id,
        reference_type: 'asset_maintenance',
        notes: dto.description,
        created_by: userId,
      },
      client,
    )

    await client.query('COMMIT')

    await AuditService.log('CREATE', 'asset_maintenance', maintenance.id, userId, undefined, maintenance)

    logInfo('Asset maintenance recorded', {
      asset_id: asset.id,
      maintenance_id: maintenance.id,
      user_id: userId,
    })
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}

// ─── 4. Complete Maintenance ─────────────────────────────────────────────────

/**
 * Complete maintenance: set asset back to ACTIVE and mark maintenance as COMPLETED.
 */
export async function completeMaintenance(
  maintenanceId: string,
  companyId: string,
  userId: string,
): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Find maintenance record
    const maintenance = await repository.findMaintenanceById(maintenanceId, companyId, client)
    if (!maintenance) throw new MaintenanceNotFoundError(maintenanceId)
    if (maintenance.status !== 'IN_PROGRESS') {
      throw new MaintenanceInvalidStatusError('IN_PROGRESS', maintenance.status)
    }

    // Complete the maintenance record
    const completionDate = new Date().toISOString().split('T')[0]
    await repository.completeMaintenance(
      maintenanceId,
      companyId,
      { completion_date: completionDate, updated_by: userId },
      client,
    )

    // Set asset back to ACTIVE
    await repository.updateStatus(maintenance.fixed_asset_id, 'ACTIVE', userId, client)

    // Record MAINTENANCE_COMPLETE movement
    await repository.createMovement(
      {
        company_id: companyId,
        fixed_asset_id: maintenance.fixed_asset_id,
        movement_type: 'MAINTENANCE_COMPLETE',
        movement_date: completionDate,
        from_value: 'MAINTENANCE',
        to_value: 'ACTIVE',
        reference_id: maintenanceId,
        reference_type: 'asset_maintenance',
        notes: `Maintenance completed`,
        created_by: userId,
      },
      client,
    )

    await client.query('COMMIT')

    await AuditService.log('UPDATE', 'asset_maintenance', maintenanceId, userId, { status: 'IN_PROGRESS' }, { status: 'COMPLETED' })

    logInfo('Asset maintenance completed', {
      maintenance_id: maintenanceId,
      asset_id: maintenance.fixed_asset_id,
      user_id: userId,
    })
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}

// ─── 6. Create Disposal ──────────────────────────────────────────────────────

/**
 * Create a disposal draft:
 * - Validate asset status is ACTIVE or MAINTENANCE
 * - For INDIVIDUAL: book_value = cost - accumulated_depreciation (full disposal)
 * - For POOLED: book_value = (quantity_disposed / quantity) * current_book_value (partial disposal)
 * - Calculate gain_loss = proceeds - book_value
 * - Create disposal record (status DRAFT)
 */
export async function createDisposal(
  dto: CreateDisposalDto,
  companyId: string,
  userId: string,
): Promise<AssetDisposal> {
  // Find and validate asset
  const asset = await repository.findById(dto.fixed_asset_id, companyId)
  if (!asset) throw new FixedAssetNotFoundError(dto.fixed_asset_id)

  if (asset.status !== 'ACTIVE' && asset.status !== 'MAINTENANCE') {
    throw new DisposalInvalidStatusError(asset.asset_code, asset.status)
  }

  const category = await repository.findCategoryById(asset.asset_category_id, companyId)
  const isPooled = category?.tracking_method === 'POOLED'

  let bookValue: number
  let quantityDisposed: number | null = null

  if (isPooled) {
    // Partial disposal for pooled assets
    quantityDisposed = dto.quantity_disposed ?? asset.quantity // default: dispose all
    if (quantityDisposed > asset.quantity) {
      throw new Error(`Jumlah disposal (${quantityDisposed}) melebihi stok tersedia (${asset.quantity})`)
    }
    // Pro-rate book value based on quantity
    const totalBookValue = asset.cost - asset.accumulated_depreciation
    bookValue = Math.round((quantityDisposed / asset.quantity) * totalBookValue * 10000) / 10000
  } else {
    // Full disposal for individual assets
    bookValue = asset.cost - asset.accumulated_depreciation
  }

  const gainLoss = dto.proceeds_amount - bookValue

  // Create disposal record (DRAFT)
  const disposal = await repository.createDisposal({
    company_id: companyId,
    fixed_asset_id: asset.id,
    disposal_date: dto.disposal_date,
    disposal_method: dto.disposal_method,
    proceeds_amount: dto.proceeds_amount,
    book_value_at_disposal: bookValue,
    gain_loss_amount: gainLoss,
    quantity_disposed: quantityDisposed,
    notes: dto.notes ?? null,
    created_by: userId,
  })

  await AuditService.log('CREATE', 'asset_disposal', disposal.id, userId, undefined, disposal)

  logInfo('Asset disposal created', {
    disposal_id: disposal.id,
    asset_id: asset.id,
    book_value: bookValue,
    gain_loss: gainLoss,
    quantity_disposed: quantityDisposed,
    is_pooled: isPooled,
    user_id: userId,
  })

  return disposal
}

// ─── 7. Post Disposal ────────────────────────────────────────────────────────

/**
 * Post disposal journal:
 *   Dr Accumulated Depreciation (proportional for pooled, full for individual)
 *   Dr Cash/Receivable (proceeds, if > 0)
 *   Dr Loss on Disposal 770201 (if loss)
 *   Cr Asset Cost COA (book value disposed)
 *   Cr Gain on Disposal 770101 (if gain)
 *
 * For INDIVIDUAL: set asset status to DISPOSED.
 * For POOLED partial: reduce quantity and cost, keep asset ACTIVE.
 * For POOLED full (qty_disposed == total qty): set asset status to DISPOSED.
 * Record DISPOSAL movement.
 */
export async function postDisposal(
  disposalId: string,
  companyId: string,
  userId: string,
): Promise<void> {
  const disposal = await repository.findDisposalById(disposalId, companyId)
  if (!disposal) throw new DisposalNotFoundError(disposalId)
  if (disposal.status !== 'DRAFT') {
    throw new DisposalAlreadyPostedError()
  }

  const asset = await repository.findById(disposal.fixed_asset_id, companyId)
  if (!asset) throw new FixedAssetNotFoundError(disposal.fixed_asset_id)

  const category = await repository.findCategoryById(asset.asset_category_id, companyId)
  if (!category) throw new AssetCategoryNotFoundError(asset.asset_category_id)

  const isPooled = category.tracking_method === 'POOLED'
  const isPartialDisposal = isPooled && disposal.quantity_disposed !== null && disposal.quantity_disposed < asset.quantity

  const cashCoaId = await resolveCoaId(companyId, CASH_RECEIVABLE_COA_CODE)
  const gainCoaId = await resolveCoaId(companyId, GAIN_ON_DISPOSAL_COA_CODE)
  const lossCoaId = await resolveCoaId(companyId, LOSS_ON_DISPOSAL_COA_CODE)

  const gainLoss = disposal.gain_loss_amount
  const priorAssetStatus = asset.status

  // For partial pooled disposal, calculate the proportional accumulated depreciation
  const disposedAccumDepr = isPartialDisposal
    ? Math.round((disposal.quantity_disposed! / asset.quantity) * asset.accumulated_depreciation * 10000) / 10000
    : asset.accumulated_depreciation

  // The cost credit is book_value_at_disposal + proportional accum depr (to remove the full original cost portion)
  const costCredited = disposal.book_value_at_disposal + disposedAccumDepr

  const lines: CreateJournalLineDto[] = []
  let lineNum = 1

  if (disposedAccumDepr > 0) {
    lines.push({
      line_number: lineNum++,
      account_id: category.accumulated_depreciation_coa_id,
      description: `Akumulasi Penyusutan - ${asset.asset_code}${isPartialDisposal ? ` (${disposal.quantity_disposed} ${asset.uom})` : ''}`,
      debit_amount: disposedAccumDepr,
      credit_amount: 0,
    })
  }

  if (disposal.proceeds_amount > 0) {
    lines.push({
      line_number: lineNum++,
      account_id: cashCoaId,
      description: `Hasil Penjualan Aset - ${asset.asset_code}`,
      debit_amount: disposal.proceeds_amount,
      credit_amount: 0,
    })
  }

  if (gainLoss < 0) {
    lines.push({
      line_number: lineNum++,
      account_id: lossCoaId,
      description: `Rugi Pelepasan Aset - ${asset.asset_code}`,
      debit_amount: Math.abs(gainLoss),
      credit_amount: 0,
    })
  }

  lines.push({
    line_number: lineNum++,
    account_id: category.asset_coa_id,
    description: `Pelepasan Aset - ${asset.asset_code}${isPartialDisposal ? ` (${disposal.quantity_disposed} ${asset.uom})` : ''}`,
    debit_amount: 0,
    credit_amount: costCredited,
  })

  if (gainLoss > 0) {
    lines.push({
      line_number: lineNum++,
      account_id: gainCoaId,
      description: `Laba Pelepasan Aset - ${asset.asset_code}`,
      debit_amount: 0,
      credit_amount: gainLoss,
    })
  }

  const journalId = await createAndPostJournal(
    {
      company_id: companyId,
      branch_id: asset.branch_id,
      journal_date: disposal.disposal_date,
      source_module: 'fixed_assets',
      reference_type: 'asset_disposal',
      reference_id: disposal.id,
      description: `Pelepasan Aset ${asset.asset_code} - ${asset.asset_name}${isPartialDisposal ? ` (${disposal.quantity_disposed} ${asset.uom})` : ''}`,
      lines,
    },
    userId,
  )

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const posted = await repository.postDisposal(
      disposalId,
      companyId,
      { journal_id: journalId, posted_by: userId },
      client,
    )
    if (!posted) throw new DisposalNotFoundError(disposalId)

    if (isPartialDisposal) {
      // Partial disposal: reduce quantity, cost, and accumulated_depreciation proportionally
      await repository.applyPartialDisposal(
        asset.id,
        {
          quantity_disposed: disposal.quantity_disposed!,
          cost_reduction: costCredited,
          accum_depr_reduction: disposedAccumDepr,
          updated_by: userId,
        },
        client,
      )
    } else {
      // Full disposal: set asset status to DISPOSED
      await repository.updateStatus(asset.id, 'DISPOSED', userId, client)
    }

    await repository.createMovement(
      {
        company_id: companyId,
        fixed_asset_id: asset.id,
        movement_type: 'DISPOSAL',
        movement_date: disposal.disposal_date,
        from_value: isPartialDisposal ? `qty:${asset.quantity}` : priorAssetStatus,
        to_value: isPartialDisposal ? `qty:${asset.quantity - disposal.quantity_disposed!}` : 'DISPOSED',
        reference_id: disposalId,
        reference_type: 'asset_disposal',
        notes: `${disposal.disposal_method}${isPartialDisposal ? ` - ${disposal.quantity_disposed} ${asset.uom}` : ''} - Proceeds: ${disposal.proceeds_amount}`,
        created_by: userId,
      },
      client,
    )

    await client.query('COMMIT')

    await AuditService.log(
      'UPDATE',
      'asset_disposal',
      disposalId,
      userId,
      { status: 'DRAFT' },
      { status: 'POSTED', journal_id: journalId },
    )

    logInfo('Asset disposal posted', {
      disposal_id: disposalId,
      asset_id: asset.id,
      journal_id: journalId,
      gain_loss: gainLoss,
      is_partial: isPartialDisposal,
      quantity_disposed: disposal.quantity_disposed,
      user_id: userId,
    })
  } catch (e) {
    await client.query('ROLLBACK')
    try {
      await journalHeadersService.reverseAsUser(
        journalId,
        `Rollback failed disposal post ${disposalId}`,
        userId,
      )
    } catch (revErr: unknown) {
      logError('Failed to reverse disposal journal after rollback', {
        journal_id: journalId,
        error: revErr instanceof Error ? revErr.message : revErr,
      })
    }
    throw e
  } finally {
    client.release()
  }
}
