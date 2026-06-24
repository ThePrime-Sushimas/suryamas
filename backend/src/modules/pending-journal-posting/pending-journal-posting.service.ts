import { pendingJournalPostingRepository, type PendingModule, type PendingPostingRow, type PendingPostingSummaryRow } from './pending-journal-posting.repository'
import { getAccessibleBranchIds, getAccessibleCompanyIds } from '../../utils/branch-access.util'
import { BusinessRuleError } from '../../utils/errors.base'
import { logInfo, logError } from '../../config/logger'

// Module service imports
import { purchaseInvoicesService } from '../purchase-invoices/purchase-invoices.service'
import { generalInvoiceService } from '../general-invoices/general-invoices.service'
import { apPaymentsService } from '../ap-payments/ap-payments.service'
import * as assetLifecycleService from '../fixed-assets/asset-lifecycle.service'
import { stockAdjustmentsService } from '../stock-adjustments/stock-adjustments.service'
import { stockTransfersService } from '../stock-transfers/stock-transfers.service'
import { productionOrdersService } from '../food-production/production-orders/production-orders.service'
import { marketplacePoService } from '../marketplace-po/marketplace-po.service'

export const VALID_MODULES: PendingModule[] = [
  'purchase_invoices',
  'general_invoices',
  'ap_payments',
  'asset_disposals',
  'stock_adjustments',
  'stock_transfers',
  'production_orders',
  'marketplace_po',
]

export interface PostResult {
  success: boolean
  module: PendingModule
  id: string
  error?: string
}

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
   */
  async postSingle(
    module: PendingModule,
    id: string,
    userId: string,
  ): Promise<PostResult> {
    if (!VALID_MODULES.includes(module)) {
      throw new BusinessRuleError(`Module '${module}' is not supported`)
    }

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

      default:
        throw new BusinessRuleError(`Module '${module}' is not supported`)
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
    if (!VALID_MODULES.includes(module)) {
      throw new BusinessRuleError(`Module '${module}' is not supported`)
    }
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
