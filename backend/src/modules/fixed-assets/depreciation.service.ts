import { pool } from '../../config/db'
import { journalHeadersService } from '../accounting/journals/journal-headers/journal-headers.service'
import { journalHeadersRepository } from '../accounting/journals/journal-headers/journal-headers.repository'
import { fiscalPeriodsRepository } from '../accounting/fiscal-periods/fiscal-periods.repository'
import type { FiscalPeriod } from '../accounting/fiscal-periods/fiscal-periods.types'
import type { CreateJournalLineDto } from '../accounting/journals/journal-headers/journal-headers.types'
import * as repository from './fixed-assets.repository'
import {
  DepreciationAlreadyPostedError,
  PeriodNotOpenError,
  DepreciationRunNotFoundError,
  DepreciationRunInvalidStatusError,
  CoaNotFoundError,
} from './fixed-assets.errors'
import type {
  FixedAsset,
  DepreciationPreviewEntry,
  DepreciationRunResult,
} from './fixed-assets.types'
import { logInfo, logError } from '../../config/logger'
import { AuditService } from '../monitoring/monitoring.service'

// ─── Depreciation Calculation ────────────────────────────────────────────────

/**
 * Calculate monthly depreciation for a single asset.
 * Uses straight-line method: (cost - salvage_value) / useful_life_months
 * Handles final-month remainder to prevent over-depreciation.
 * Returns 4 decimal precision.
 */
export function calculateMonthlyDepreciation(asset: FixedAsset): number {
  const totalDepreciable = asset.cost - asset.salvage_value
  const remaining = totalDepreciable - asset.accumulated_depreciation

  // Already fully depreciated
  if (remaining <= 0) return 0

  const standardMonthly = totalDepreciable / asset.useful_life_months

  // Final month: use remaining amount (prevents over-depreciation)
  if (remaining < standardMonthly) {
    return Math.round(remaining * 10000) / 10000
  }

  return Math.round(standardMonthly * 10000) / 10000
}

// ─── Depreciation Run Execution ──────────────────────────────────────────────

/**
 * Execute depreciation run for a company + fiscal period.
 * Steps:
 * 1. Validate fiscal period is open
 * 2. Check idempotency (no existing POSTED run for same company+period)
 * 3. Fetch all ACTIVE + MAINTENANCE assets (not fully depreciated)
 * 4. Calculate depreciation per asset
 * 5. PREVIEW mode: return entries without persisting
 * 6. CONFIRM mode: persist entries, update accumulated_depreciation, post journal
 */
export async function executeDepreciationRun(
  companyId: string,
  fiscalPeriodId: string,
  mode: 'PREVIEW' | 'CONFIRM',
  userId: string,
): Promise<DepreciationRunResult> {
  // 1. Validate period is open
  const period = await fiscalPeriodsRepository.findById(fiscalPeriodId, companyId)
  if (!period || !period.is_open) throw new PeriodNotOpenError()

  // 2. Idempotency check (only for CONFIRM)
  if (mode === 'CONFIRM') {
    const existing = await repository.findPostedRun(companyId, fiscalPeriodId)
    if (existing) throw new DepreciationAlreadyPostedError(period.period)
  }

  // 3. Fetch eligible assets (ACTIVE or MAINTENANCE, not fully depreciated)
  const assets = await repository.findDepreciableAssets(companyId)
  if (assets.length === 0) {
    return {
      run_id: '',
      status: 'PREVIEW',
      fiscal_period_id: fiscalPeriodId,
      total_depreciation_amount: 0,
      asset_count: 0,
      entries: [],
    }
  }

  // 4. Calculate entries
  const entries: DepreciationPreviewEntry[] = assets
    .map((asset) => {
      const amount = calculateMonthlyDepreciation(asset)
      return {
        fixed_asset_id: asset.id,
        asset_code: asset.asset_code,
        asset_name: asset.asset_name,
        cost: asset.cost,
        salvage_value: asset.salvage_value,
        useful_life_months: asset.useful_life_months,
        accumulated_before: asset.accumulated_depreciation,
        depreciation_amount: amount,
        accumulated_after: asset.accumulated_depreciation + amount,
        book_value_after: asset.cost - (asset.accumulated_depreciation + amount),
      }
    })
    .filter((e) => e.depreciation_amount > 0)

  const totalAmount = entries.reduce((sum, e) => sum + e.depreciation_amount, 0)

  // 5. Preview mode: return without persisting
  if (mode === 'PREVIEW') {
    return {
      run_id: '',
      status: 'PREVIEW',
      fiscal_period_id: fiscalPeriodId,
      total_depreciation_amount: Math.round(totalAmount * 10000) / 10000,
      asset_count: entries.length,
      entries,
    }
  }

  // 6. Confirm mode: post journals (one per branch), then persist asset updates in transaction
  let journalIds: string[] = []
  try {
    journalIds = await postDepreciationJournals(companyId, period, entries, userId)
  } catch (e) {
    throw e
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const run = await repository.createRun(
      {
        company_id: companyId,
        fiscal_period_id: fiscalPeriodId,
        status: 'POSTED',
        total_depreciation_amount: Math.round(totalAmount * 10000) / 10000,
        asset_count: entries.length,
        created_by: userId,
      },
      client,
    )

    await repository.bulkInsertEntries(run.id, entries, client)

    for (const entry of entries) {
      await repository.incrementAccumulatedDepreciation(
        entry.fixed_asset_id,
        entry.depreciation_amount,
        client,
      )

      await repository.createMovement(
        {
          company_id: companyId,
          fixed_asset_id: entry.fixed_asset_id,
          movement_type: 'DEPRECIATION',
          movement_date: period.period_end,
          from_value: String(entry.accumulated_before),
          to_value: String(entry.accumulated_after),
          reference_id: run.id,
          reference_type: 'depreciation_run',
          created_by: userId,
        },
        client,
      )
    }

    await repository.updateRunJournals(run.id, journalIds, client)

    await client.query('COMMIT')

    await AuditService.log(
      'CREATE',
      'depreciation_run',
      run.id,
      userId,
      undefined,
      { fiscal_period_id: fiscalPeriodId, total_amount: totalAmount, asset_count: entries.length, journal_ids: journalIds },
    )

    logInfo('Depreciation run confirmed', {
      run_id: run.id,
      company_id: companyId,
      period: period.period,
      asset_count: entries.length,
      total_amount: totalAmount,
      journal_count: journalIds.length,
    })

    return {
      run_id: run.id,
      status: 'POSTED',
      fiscal_period_id: fiscalPeriodId,
      total_depreciation_amount: Math.round(totalAmount * 10000) / 10000,
      asset_count: entries.length,
      entries,
      journal_ids: journalIds,
    }
  } catch (e) {
    await client.query('ROLLBACK')
    if (journalIds.length > 0) {
      for (const jId of journalIds) {
        try {
          await journalHeadersService.reverseAsUser(
            jId,
            `Rollback failed depreciation run for period ${period.period}`,
            userId,
          )
        } catch (revErr: unknown) {
          logError('Failed to reverse depreciation journal after rollback', {
            journal_id: jId,
            error: revErr instanceof Error ? revErr.message : revErr,
          })
        }
      }
    }
    throw e
  } finally {
    client.release()
  }
}

// ─── Depreciation Journal Posting (Per Branch) ───────────────────────────────

/**
 * Post depreciation journals split by branch:
 *   - Groups entries by asset.branch_id
 *   - Creates one journal per branch with correct branch_id
 *   - Each journal:
 *       Dr depreciation_expense_coa_id = branch subtotal
 *       Cr accumulated_depreciation_coa_id = per-category subtotal
 *
 * Returns array of journal IDs created.
 */
async function postDepreciationJournals(
  companyId: string,
  period: FiscalPeriod,
  entries: DepreciationPreviewEntry[],
  userId: string,
): Promise<string[]> {
  const assetIds = entries.map((e) => e.fixed_asset_id)
  const assets = await repository.findByIds(assetIds, companyId)
  const assetMap = new Map(assets.map((a) => [a.id, a]))

  const categoryIds = [...new Set(assets.map((a) => a.asset_category_id))]
  const categories = await repository.findCategoriesByIds(categoryIds, companyId)
  const categoryMap = new Map(categories.map((c) => [c.id, c]))

  // Group entries by branch_id
  const branchEntries = new Map<string, DepreciationPreviewEntry[]>()
  for (const entry of entries) {
    const asset = assetMap.get(entry.fixed_asset_id)
    if (!asset) {
      logError('Depreciation entry skipped: asset not found in assetMap (data inconsistency)', {
        fixed_asset_id: entry.fixed_asset_id,
        asset_code: entry.asset_code,
      })
      continue
    }
    const branchId = asset.branch_id
    if (!branchEntries.has(branchId)) {
      branchEntries.set(branchId, [])
    }
    branchEntries.get(branchId)!.push(entry)
  }

  const journalIds: string[] = []

  for (const [branchId, branchGroupEntries] of branchEntries) {
    const expenseTotals = new Map<string, number>()
    const creditTotals = new Map<string, number>()

    for (const entry of branchGroupEntries) {
      const asset = assetMap.get(entry.fixed_asset_id)
      if (!asset) continue // already logged above
      const category = categoryMap.get(asset.asset_category_id)
      if (!category) {
        logError('Depreciation entry skipped: category not found (missing COA config)', {
          fixed_asset_id: entry.fixed_asset_id,
          asset_code: entry.asset_code,
          asset_category_id: asset.asset_category_id,
        })
        continue
      }

      expenseTotals.set(
        category.depreciation_expense_coa_id,
        (expenseTotals.get(category.depreciation_expense_coa_id) ?? 0) + entry.depreciation_amount,
      )
      creditTotals.set(
        category.accumulated_depreciation_coa_id,
        (creditTotals.get(category.accumulated_depreciation_coa_id) ?? 0) + entry.depreciation_amount,
      )
    }

    if (expenseTotals.size === 0) continue

    const lines: CreateJournalLineDto[] = []
    let lineNum = 1

    for (const [coaId, amount] of expenseTotals) {
      lines.push({
        line_number: lineNum++,
        account_id: coaId,
        description: 'Beban Penyusutan Aset Tetap',
        debit_amount: Math.round(amount * 10000) / 10000,
        credit_amount: 0,
      })
    }

    for (const [coaId, amount] of creditTotals) {
      lines.push({
        line_number: lineNum++,
        account_id: coaId,
        description: 'Akumulasi Penyusutan',
        debit_amount: 0,
        credit_amount: Math.round(amount * 10000) / 10000,
      })
    }

    // Create journal with branch_id
    const journal = await journalHeadersService.create(
      {
        company_id: companyId,
        branch_id: branchId,
        journal_date: period.period_end,
        journal_type: 'ASSET',
        source_module: 'fixed_assets',
        reference_type: 'depreciation_run',
        description: `Penyusutan Aset Tetap - ${period.period}`,
        currency: 'IDR',
        exchange_rate: 1,
        lines,
      },
      userId,
    )

    // Auto-post the journal
    await journalHeadersService.submitAsUser(journal.id, userId)
    await journalHeadersService.approveAsUser(journal.id, userId)
    await journalHeadersService.postAsUser(journal.id, userId)

    journalIds.push(journal.id)
  }

  if (journalIds.length === 0) {
    throw new CoaNotFoundError(
      'depreciation expense — no journals created (all entries skipped due to missing asset/category mapping)',
    )
  }

  return journalIds
}

// ─── Depreciation Run Reversal ───────────────────────────────────────────────

/**
 * Reverse a posted depreciation run (hard-delete pattern):
 * 1. Validate run is POSTED and fiscal period is still open
 * 2. Decrement accumulated_depreciation on each asset
 * 3. Delete depreciation movements (reference_id = run)
 * 4. Delete depreciation entries
 * 5. Hard delete journal_lines + journal_headers
 * 6. Delete run record
 *
 * Uses hard-delete instead of counter-journals to keep the journal ledger clean —
 * reversal journals cause user confusion in financial reports and are unnecessary
 * for internal depreciation corrections.
 *
 * Result: state is identical to before the run was posted — no trace in journals.
 */
export async function reverseDepreciationRun(
  runId: string,
  companyId: string,
  userId: string,
): Promise<void> {
  // Find posted run
  const run = await repository.findRunById(runId, companyId)
  if (!run) throw new DepreciationRunNotFoundError(runId)
  if (run.status !== 'POSTED') {
    throw new DepreciationRunInvalidStatusError('POSTED', run.status)
  }

  // Guard: cannot reverse if fiscal period is already closed
  const period = await fiscalPeriodsRepository.findById(run.fiscal_period_id, companyId)
  if (period && !period.is_open) {
    throw new PeriodNotOpenError()
  }

  // Get run entries to rollback accumulated_depreciation
  const entries = await repository.findRunEntries(runId)
  if (entries.length === 0) {
    throw new DepreciationRunNotFoundError(runId)
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 1. Rollback accumulated_depreciation on each asset
    for (const entry of entries) {
      await repository.decrementAccumulatedDepreciation(
        entry.fixed_asset_id,
        entry.depreciation_amount,
        client,
      )
    }

    // 2. Delete movement records for this run
    await repository.deleteDepreciationMovements(runId, client)

    // 3. Delete depreciation entries
    await repository.deleteRunEntries(runId, client)

    // 4. Hard delete journals (lines + headers)
    const journalIds = run.journal_ids ?? []
    await journalHeadersRepository.bulkHardDelete(journalIds, client)

    // 5. Delete the run record itself
    await repository.deleteRun(runId, client)

    await client.query('COMMIT')

    await AuditService.log('DELETE', 'depreciation_run', runId, userId, {
      status: 'POSTED',
      journal_ids: journalIds,
      asset_count: entries.length,
      total_amount: run.total_depreciation_amount,
    })

    logInfo('Depreciation run hard-deleted (reversed)', {
      run_id: runId,
      company_id: companyId,
      journal_ids: journalIds,
      asset_count: entries.length,
      user_id: userId,
    })
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}

// ─── Depreciation Run Reversal from Journal ForceDelete ──────────────────────

/**
 * Called when a depreciation journal is force-deleted from the journal page.
 * Finds the owning depreciation run, rolls back all side-effects, and deletes
 * the run + sibling journals (since a run can have multiple journals, one per branch).
 *
 * @param runId - The depreciation run ID (from journal.reference_id)
 * @param companyId - Company scope
 * @param triggerJournalId - The journal being deleted (will be excluded from sibling cleanup since it's already being deleted by the caller)
 * @param userId - User performing the action
 */
export async function reverseDepreciationRunFromJournal(
  runId: string,
  companyId: string,
  triggerJournalId: string,
  userId: string,
): Promise<void> {
  const run = await repository.findRunById(runId, companyId)
  if (!run || run.status !== 'POSTED') {
    // Run already reversed/deleted or not found — nothing to do
    return
  }

  // Guard: cannot reverse if fiscal period is already closed
  const period = await fiscalPeriodsRepository.findById(run.fiscal_period_id, companyId)
  if (period && !period.is_open) {
    throw new PeriodNotOpenError()
  }

  const entries = await repository.findRunEntries(runId)
  if (entries.length === 0) {
    // No entries found — data may be corrupt; still delete the orphan run record
    logError('reverseDepreciationRunFromJournal: run has no entries (possible data corruption)', {
      run_id: runId,
      company_id: companyId,
    })
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await repository.deleteRun(runId, client)
      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
    return
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 1. Rollback accumulated_depreciation on each asset
    for (const entry of entries) {
      await repository.decrementAccumulatedDepreciation(
        entry.fixed_asset_id,
        entry.depreciation_amount,
        client,
      )
    }

    // 2. Delete movement records for this run
    await repository.deleteDepreciationMovements(runId, client)

    // 3. Delete depreciation entries
    await repository.deleteRunEntries(runId, client)

    // 4. Hard delete sibling journals (excluding the one already being deleted by caller)
    const siblingJournalIds = (run.journal_ids ?? []).filter(jId => jId !== triggerJournalId)
    await journalHeadersRepository.bulkHardDelete(siblingJournalIds, client)

    // 5. Delete the run record itself
    await repository.deleteRun(runId, client)

    await client.query('COMMIT')

    await AuditService.log('DELETE', 'depreciation_run', runId, userId, {
      status: 'POSTED',
      trigger: 'journal_force_delete',
      trigger_journal_id: triggerJournalId,
      journal_ids: run.journal_ids,
      asset_count: entries.length,
      total_amount: run.total_depreciation_amount,
    })

    logInfo('Depreciation run cascade-deleted from journal forceDelete', {
      run_id: runId,
      company_id: companyId,
      trigger_journal_id: triggerJournalId,
      sibling_journals_deleted: siblingJournalIds,
      asset_count: entries.length,
      user_id: userId,
    })
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}
