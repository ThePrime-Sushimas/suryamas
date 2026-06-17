import { pool } from '../../config/db'
import { journalHeadersService } from '../accounting/journals/journal-headers/journal-headers.service'
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

  // 6. Confirm mode: post journal first, then persist asset updates in transaction
  let journalId: string | null = null
  try {
    journalId = await postDepreciationJournal(companyId, period, entries, userId)
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

    await repository.updateRunJournal(run.id, journalId, client)

    await client.query('COMMIT')

    await AuditService.log(
      'CREATE',
      'depreciation_run',
      run.id,
      userId,
      undefined,
      { fiscal_period_id: fiscalPeriodId, total_amount: totalAmount, asset_count: entries.length, journal_id: journalId },
    )

    logInfo('Depreciation run confirmed', {
      run_id: run.id,
      company_id: companyId,
      period: period.period,
      asset_count: entries.length,
      total_amount: totalAmount,
    })

    return {
      run_id: run.id,
      status: 'POSTED',
      fiscal_period_id: fiscalPeriodId,
      total_depreciation_amount: Math.round(totalAmount * 10000) / 10000,
      asset_count: entries.length,
      entries,
      journal_id: journalId,
    }
  } catch (e) {
    await client.query('ROLLBACK')
    if (journalId) {
      try {
        await journalHeadersService.reverseAsUser(
          journalId,
          `Rollback failed depreciation run for period ${period.period}`,
          userId,
        )
      } catch (revErr: unknown) {
        logError('Failed to reverse depreciation journal after rollback', {
          journal_id: journalId,
          error: revErr instanceof Error ? revErr.message : revErr,
        })
      }
    }
    throw e
  } finally {
    client.release()
  }
}

// ─── Depreciation Journal Posting ────────────────────────────────────────────

/**
 * Post consolidated depreciation journal:
 *   Dr 620101 (depreciation_expense_coa_id) = total_depreciation
 *   Cr {category.accumulated_depreciation_coa_id} = per-category subtotal
 *
 * Lines are grouped by category COA for the credit side.
 */
async function postDepreciationJournal(
  companyId: string,
  period: FiscalPeriod,
  entries: DepreciationPreviewEntry[],
  userId: string,
): Promise<string> {
  const assetIds = entries.map((e) => e.fixed_asset_id)
  const assets = await repository.findByIds(assetIds, companyId)
  const assetMap = new Map(assets.map((a) => [a.id, a]))

  const categoryIds = [...new Set(assets.map((a) => a.asset_category_id))]
  const categories = await repository.findCategoriesByIds(categoryIds, companyId)
  const categoryMap = new Map(categories.map((c) => [c.id, c]))

  const expenseTotals = new Map<string, number>()
  const creditTotals = new Map<string, number>()

  for (const entry of entries) {
    const asset = assetMap.get(entry.fixed_asset_id)
    if (!asset) continue
    const category = categoryMap.get(asset.asset_category_id)
    if (!category) continue

    expenseTotals.set(
      category.depreciation_expense_coa_id,
      (expenseTotals.get(category.depreciation_expense_coa_id) ?? 0) + entry.depreciation_amount,
    )
    creditTotals.set(
      category.accumulated_depreciation_coa_id,
      (creditTotals.get(category.accumulated_depreciation_coa_id) ?? 0) + entry.depreciation_amount,
    )
  }

  if (expenseTotals.size === 0) {
    throw new CoaNotFoundError('depreciation expense')
  }

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

  // Create journal using the standard workflow: create → submit → approve → post
  const journal = await journalHeadersService.create(
    {
      company_id: companyId,
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

  return journal.id
}

// ─── Depreciation Run Reversal ───────────────────────────────────────────────

/**
 * Reverse a posted depreciation run:
 * 1. Find posted run
 * 2. Create counter-journal (negate original)
 * 3. Rollback accumulated_depreciation on each asset
 * 4. Update run status to REVERSED
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

  // Get run entries to rollback
  const entries = await repository.findRunEntries(runId)
  if (entries.length === 0) {
    throw new DepreciationRunNotFoundError(runId)
  }

  // Reverse the original journal if exists
  let reversalJournalId: string | null = null
  if (run.journal_id) {
    const reversalJournal = await journalHeadersService.reverseAsUser(
      run.journal_id,
      `Reversal penyusutan periode ${run.fiscal_period_id}`,
      userId,
    )
    reversalJournalId = reversalJournal.id
  }

  // Rollback accumulated_depreciation on each asset
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    for (const entry of entries) {
      await repository.decrementAccumulatedDepreciation(
        entry.fixed_asset_id,
        entry.depreciation_amount,
        client,
      )
    }

    // Update run status to REVERSED
    await client.query(
      `UPDATE asset_depreciation_runs
       SET status = 'REVERSED',
           reversed_at = now(),
           reversed_by = $1,
           reversal_journal_id = $2
       WHERE id = $3 AND company_id = $4`,
      [userId, reversalJournalId, runId, companyId],
    )

    await client.query('COMMIT')

    await AuditService.log('UPDATE', 'depreciation_run', runId, userId, { status: 'POSTED' }, { status: 'REVERSED', reversal_journal_id: reversalJournalId })

    logInfo('Depreciation run reversed', {
      run_id: runId,
      company_id: companyId,
      reversal_journal_id: reversalJournalId,
      user_id: userId,
    })
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}
