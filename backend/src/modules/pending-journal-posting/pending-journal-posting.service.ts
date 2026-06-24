/**
 * ⚠️ MENAMBAH MODULE BARU? Baca dulu:
 * backend/src/modules/pending-journal-posting/ADDING_NEW_MODULE.md
 */
import { pendingJournalPostingRepository, PENDING_POSTING_MODULES, type PendingModule, type PendingPostingRow, type PendingPostingSummaryRow } from './pending-journal-posting.repository'
import { getAccessibleBranchIds, getAccessibleCompanyIds } from '../../utils/branch-access.util'
import { BusinessRuleError } from '../../utils/errors.base'
import { logInfo } from '../../config/logger'

// Module service imports
import { purchaseInvoicesService } from '../purchase-invoices/purchase-invoices.service'
import { generalInvoiceService } from '../general-invoices/general-invoices.service'
import { apPaymentsService } from '../ap-payments/ap-payments.service'
import * as assetLifecycleService from '../fixed-assets/asset-lifecycle.service'
import { stockAdjustmentsService } from '../stock-adjustments/stock-adjustments.service'
import { stockTransfersService } from '../stock-transfers/stock-transfers.service'
import { productionOrdersService } from '../food-production/production-orders/production-orders.service'
import { marketplacePoService } from '../marketplace-po/marketplace-po.service'
import { generateBankRecJournals } from '../jobs/processors/bank-reconciliation-journal.processor'
import { generateJournalsOptimized } from '../jobs/processors/pos-journals.processor'
import type { AggregatedTransaction } from '../pos-imports/pos-aggregates/pos-aggregates.types'

// ─── Exhaustiveness helper ───────────────────────────────────────────────────

function assertNever(x: never, context: string): never {
  throw new Error(`[pending-journal-posting] Unhandled ${context}: ${x}`)
}

// ─── Startup Exhaustiveness Assertion ────────────────────────────────────────
// This list MUST mirror every case in the postSingle switch below.
// If a new module is added to PENDING_POSTING_MODULES but not here,
// TypeScript will error at compile time (satisfies check below).
// If somehow bypassed, the runtime check catches it at module load.

const HANDLED_MODULES_IN_SWITCH = [
  'purchase_invoices',
  'general_invoices',
  'ap_payments',
  'asset_disposals',
  'stock_adjustments',
  'stock_transfers',
  'production_orders',
  'marketplace_po',
  'bank_reconciliation',
  'pos_aggregates',
] as const satisfies readonly PendingModule[]

// Runtime fail-fast: crash at startup if any module in the registry is missing from switch
for (const m of PENDING_POSTING_MODULES) {
  if (!(HANDLED_MODULES_IN_SWITCH as readonly string[]).includes(m)) {
    throw new Error(
      `[pending-journal-posting] Module '${m}' ada di PENDING_POSTING_MODULES ` +
      `tapi belum ada di HANDLED_MODULES_IN_SWITCH. ` +
      `Tambahkan handler di switch postSingle() dan update HANDLED_MODULES_IN_SWITCH. ` +
      `Lihat: backend/src/modules/pending-journal-posting/ADDING_NEW_MODULE.md`
    )
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PostResult {
  success: boolean
  module: PendingModule
  id: string
  error?: string
}

// ─── Service ─────────────────────────────────────────────────────────────────

class PendingJournalPostingService {
  /**
   * List pending records across ALL accessible companies with summary.
   * Multi-company safe: passes full companyIds[] to repository which uses ANY($1::uuid[]).
   */
  async list(
    userId: string,
    options: { dateFrom?: string; dateTo?: string; module?: PendingModule; branchId?: string; page: number; limit: number },
  ): Promise<{ data: PendingPostingRow[]; summary: PendingPostingSummaryRow[]; total: number; page: number; limit: number }> {
    const companyIds = await getAccessibleCompanyIds(userId)
    if (companyIds.length === 0) throw new BusinessRuleError('No accessible company')

    const [listResult, summaryRows] = await Promise.all([
      pendingJournalPostingRepository.findPendingRecords({
        companyIds,
        dateFrom: options.dateFrom,
        dateTo: options.dateTo,
        module: options.module,
        branchId: options.branchId,
        page: options.page,
        limit: options.limit,
      }),
      pendingJournalPostingRepository.getSummary(companyIds, options.dateFrom, options.dateTo, options.branchId),
    ])

    return {
      data: listResult.data,
      summary: summaryRows,
      total: listResult.total,
      page: options.page,
      limit: options.limit,
    }
  }

  /**
   * Post a single record's journal by routing to the correct module service.
   * Uses exhaustive switch — TypeScript enforces all PendingModule values are handled.
   */
  async postSingle(
    module: PendingModule,
    id: string,
    userId: string,
  ): Promise<PostResult> {
    const branchIds = await getAccessibleBranchIds(userId)
    const companyIds = await getAccessibleCompanyIds(userId)

    switch (module) {
      case 'purchase_invoices':
        await purchaseInvoicesService.post(id, branchIds, userId)
        break

      case 'general_invoices':
        await generalInvoiceService.post(id, branchIds, userId)
        break

      case 'ap_payments':
        await apPaymentsService.postJournal(id, branchIds, userId)
        break

      case 'asset_disposals':
        if (companyIds.length === 0) throw new BusinessRuleError('No accessible company for asset disposal')
        await assetLifecycleService.postDisposal(id, companyIds[0], userId)
        break

      case 'stock_adjustments':
        await stockAdjustmentsService.generateJournal(id, branchIds, userId)
        break

      case 'stock_transfers':
        await stockTransfersService.regenerateJournals(id, branchIds, userId)
        break

      case 'production_orders':
        await productionOrdersService.generateJournal(id, companyIds, branchIds, userId)
        break

      case 'marketplace_po':
        await marketplacePoService.postReceiveJournal(companyIds, branchIds, userId, id, {})
        break

      case 'bank_reconciliation': {
        // id format: 'bank_account_id|transaction_date'
        const [bankAccountId, bankTxDate] = id.split('|')
        if (!bankAccountId || !bankTxDate) throw new BusinessRuleError('Invalid bank_reconciliation group ID format')
        const statementIds = await pendingJournalPostingRepository.findBankStatementIdsInGroup(
          bankAccountId, bankTxDate, companyIds
        )
        if (statementIds.length === 0) throw new BusinessRuleError('Tidak ada bank statement yang eligible untuk diproses')
        const bankResult = await generateBankRecJournals(statementIds, companyIds[0])
        if (bankResult.failed.length > 0 && bankResult.success.length === 0) {
          throw new BusinessRuleError(bankResult.failed[0].error)
        }
        break
      }

      case 'pos_aggregates': {
        // id format: 'branch_id|transaction_date'
        const [posBranchId, posTxDate] = id.split('|')
        if (!posBranchId || !posTxDate) throw new BusinessRuleError('Invalid pos_aggregates group ID format')
        const txRows = await pendingJournalPostingRepository.findPosAggregateTransactionsInGroup(posBranchId, posTxDate)
        if (txRows.length === 0) throw new BusinessRuleError('Tidak ada transaksi POS yang eligible untuk diproses')
        const posResult = await generateJournalsOptimized(txRows as unknown as AggregatedTransaction[], companyIds[0])
        if (posResult.failed.length > 0 && posResult.success.length === 0) {
          throw new BusinessRuleError(posResult.failed[0].error)
        }
        break
      }

      default:
        // TypeScript compile-time exhaustiveness check:
        // If a new value is added to PendingModule but no case is added above,
        // this line will show a compile error: "Argument of type 'xxx' is not assignable to parameter of type 'never'"
        assertNever(module, 'module in postSingle')
    }

    logInfo('Pending journal posted via orchestrator', { module, id, userId })
    return { success: true, module, id }
  }

  /**
   * Bulk post multiple records in the SAME module.
   * Returns individual results (some may succeed while others fail).
   */
  async postBulk(
    module: PendingModule,
    ids: string[],
    userId: string,
  ): Promise<{ results: PostResult[]; success_count: number; failure_count: number }> {
    if (ids.length === 0) {
      throw new BusinessRuleError('At least 1 ID is required')
    }
    if (ids.length > 20) {
      throw new BusinessRuleError('Maximum 20 records per bulk operation')
    }

    const results: PostResult[] = []
    let success_count = 0
    let failure_count = 0

    // Process sequentially to avoid overloading DB connections
    for (const id of ids) {
      try {
        await this.postSingle(module, id, userId)
        results.push({ success: true, module, id })
        success_count++
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        results.push({ success: false, module, id, error: message })
        failure_count++
      }
    }

    logInfo('Bulk pending journal post completed', {
      module, userId, total: ids.length, success_count, failure_count,
    })

    return { results, success_count, failure_count }
  }
}

export const pendingJournalPostingService = new PendingJournalPostingService()
