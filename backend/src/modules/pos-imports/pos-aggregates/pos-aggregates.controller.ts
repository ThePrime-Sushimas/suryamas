import { Response } from 'express'
import { posAggregatesService } from './pos-aggregates.service'
import { sendSuccess } from '../../../utils/response.util'
import { handleError } from '../../../utils/error-handler.util'
import { withValidated } from '../../../utils/handler'
import { logInfo } from '../../../config/logger'
import type { ValidatedRequest, ValidatedAuthRequest } from '../../../middleware/validation.middleware'
import type { BranchContext } from '../../../types/common.types'
import {
  createAggregatedTransactionSchema,
  updateAggregatedTransactionSchema,
  aggregatedTransactionIdSchema,
  aggregatedTransactionListQuerySchema,

  batchReconcileSchema,
  createBatchSchema,
  batchAssignJournalSchema,
} from './pos-aggregates.schema'
import { AuthRequest } from '../../../types/common.types'

// Type aliases for validated requests
type CreateTransactionReq = ValidatedRequest<typeof createAggregatedTransactionSchema>
type UpdateTransactionReq = ValidatedAuthRequest<typeof updateAggregatedTransactionSchema>
type TransactionIdReq = ValidatedAuthRequest<typeof aggregatedTransactionIdSchema>
type TransactionListQueryReq = ValidatedRequest<typeof aggregatedTransactionListQuerySchema>

type BatchReconcileReq = ValidatedRequest<typeof batchReconcileSchema>
type CreateBatchReq = ValidatedRequest<typeof createBatchSchema>
type BatchAssignJournalReq = ValidatedRequest<typeof batchAssignJournalSchema>

export class PosAggregatesController {
  /**
   * Create new aggregated transaction
   * POST /aggregated-transactions
   */
  create = withValidated(async (req: CreateTransactionReq, res: Response) => {
    try {
      const transaction = await posAggregatesService.createTransaction(req.validated.body)
      sendSuccess(res, transaction, 'Aggregated transaction created successfully', 201)
    } catch (error: any) {
      handleError(res, error)
    }
  })

  /**
   * List aggregated transactions with pagination and filters
   * GET /aggregated-transactions
   */
  list = withValidated(async (req: TransactionListQueryReq, res: Response) => {
    try {
      const result = await posAggregatesService.getTransactions(
        req.validated.query,
        undefined // sort - can be extended
      )
      sendSuccess(res, result.data, 'Aggregated transactions retrieved successfully', 200, result.pagination)
    } catch (error: any) {
      handleError(res, error)
    }
  })

  /**
   * Get single aggregated transaction by ID
   * GET /aggregated-transactions/:id
   */
  findById = withValidated(async (req: TransactionIdReq, res: Response) => {
    try {
      const id = req.validated.params.id
      const transaction = await posAggregatesService.getTransactionById(id)
      sendSuccess(res, transaction, 'Aggregated transaction retrieved successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  })

  /**
   * Update aggregated transaction
   * PUT /aggregated-transactions/:id
   */
  update = withValidated(async (req: UpdateTransactionReq, res: Response) => {
    try {
      const id = req.validated.params.id
      const transaction = await posAggregatesService.updateTransaction(
        id,
        req.validated.body,
        req.validated.body.version // for optimistic locking
      )
      sendSuccess(res, transaction, 'Aggregated transaction updated successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  })

  /**
   * Soft delete aggregated transaction
   * DELETE /aggregated-transactions/:id
   */
  delete = withValidated(async (req: TransactionIdReq, res: Response) => {
    try {
      const id = req.validated.params.id
      const employeeId = req.context?.employee_id
      await posAggregatesService.deleteTransaction(id, employeeId)
      sendSuccess(res, null, 'Aggregated transaction deleted successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  })

  /**
   * Restore soft-deleted transaction
   * POST /aggregated-transactions/:id/restore
   */
  restore = withValidated(async (req: TransactionIdReq, res: Response) => {
    try {
      const id = req.validated.params.id
      await posAggregatesService.restoreTransaction(id)
      sendSuccess(res, null, 'Aggregated transaction restored successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  })

  /**
   * Mark transaction as reconciled
   * POST /aggregated-transactions/:id/reconcile
   */
  reconcile = withValidated(async (req: TransactionIdReq, res: Response) => {
    try {
      const id = req.validated.params.id
      const reconciledBy = req.context?.employee_id || req.body.reconciled_by
      if (!reconciledBy) {
        return handleError(res, new Error('reconciled_by is required'))
      }
      await posAggregatesService.reconcileTransaction(id, reconciledBy)
      sendSuccess(res, null, 'Transaction reconciled successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  })

  /**
   * Batch reconcile transactions
   * POST /aggregated-transactions/batch/reconcile
   */
  batchReconcile = withValidated(async (req: BatchReconcileReq, res: Response) => {
    try {
      const { transaction_ids, reconciled_by } = req.validated.body
      const count = await posAggregatesService.reconcileBatch(transaction_ids, reconciled_by)
      sendSuccess(res, { reconciled_count: count }, `${count} transactions reconciled successfully`)
    } catch (error: any) {
      handleError(res, error)
    }
  })

  /**
   * Create multiple transactions (batch)
   * POST /aggregated-transactions/batch
   */
  createBatch = withValidated(async (req: CreateBatchReq, res: Response) => {
    try {
      const { transactions } = req.validated.body
      const result = await posAggregatesService.createBatch(transactions)
      sendSuccess(res, result, 'Batch transaction creation completed', 200, {
        total_processed: result.total_processed,
        success_count: result.success.length,
        failed_count: result.failed.length
      })
    } catch (error: any) {
      handleError(res, error)
    }
  })

  /**
   * Batch assign journal to multiple transactions
   * POST /aggregated-transactions/batch/assign-journal
   */
  batchAssignJournal = withValidated(async (req: BatchAssignJournalReq, res: Response) => {
    try {
      const { transaction_ids, journal_id } = req.validated.body
      const result = await posAggregatesService.assignJournalBatch(transaction_ids, journal_id)
      sendSuccess(res, result, 'Batch journal assignment completed', 200, {
        assigned: result.assigned,
        skipped: result.skipped
      })
    } catch (error: any) {
      handleError(res, error)
    }
  })

  /**
   * Get summary statistics
   * GET /aggregated-transactions/summary
   */
  getSummary = withValidated(async (req: TransactionListQueryReq, res: Response) => {
    try {
      const { transaction_date_from, transaction_date_to, branch_names } = req.validated.query
      
      // Parse branch_names to array if it's a comma-separated string
      let branchNamesArray: string[] | undefined
      if (branch_names) {
        if (Array.isArray(branch_names)) {
          branchNamesArray = branch_names.map(b => String(b).trim()).filter(Boolean)
        } else {
          branchNamesArray = String(branch_names).split(',').map(b => b.trim()).filter(Boolean)
        }
      }
      
      const summary = await posAggregatesService.getSummary(
        transaction_date_from ?? undefined,
        transaction_date_to ?? undefined,
        branchNamesArray
      )
      sendSuccess(res, summary, 'Summary retrieved successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  })



  /**
   * Assign journal to transaction
   * POST /aggregated-transactions/:id/assign-journal
   */
  assignJournal = withValidated(async (req: TransactionIdReq, res: Response) => {
    try {
      const id = req.validated.params.id
      const { journal_id } = req.body
      await posAggregatesService.assignJournal(id, journal_id)
      sendSuccess(res, null, 'Journal assigned successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  })

  /**
   * Check if source already exists
   * GET /aggregated-transactions/check-source
   */
  checkSource = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { source_type, source_id, source_ref } = req.query
      const exists = await posAggregatesService.checkSourceExists(
        source_type as any,
        source_id as string,
        source_ref as string
      )
      sendSuccess(res, { exists }, 'Source check completed')
    } catch (error: any) {
      handleError(res, error)
    }
  }

  /**
   * Get unreconciled transactions for journal generation
   * GET /aggregated-transactions/unreconciled
   */
  getUnreconciled = withValidated(async (req: TransactionListQueryReq, res: Response) => {
    try {
      const { transaction_date_from, transaction_date_to, branch_name } = req.validated.query

      const transactions = await posAggregatesService.getUnreconciledTransactions(
        transaction_date_from ?? undefined,
        transaction_date_to ?? undefined,
        branch_name ?? undefined
      )
      sendSuccess(res, transactions, 'Unreconciled transactions retrieved successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  })

  /**
   * List failed transactions with pagination and filters
   * GET /aggregated-transactions/failed
   */
  listFailed = withValidated(async (req: TransactionListQueryReq, res: Response) => {
    try {
      const result = await posAggregatesService.getFailedTransactions(
        req.validated.query,
        undefined
      )
      sendSuccess(res, result.data, 'Failed transactions retrieved successfully', 200, result.pagination)
    } catch (error: any) {
      handleError(res, error)
    }
  })

  /**
   * Get failed transaction details
   * GET /aggregated-transactions/failed/:id
   */
  findFailedById = withValidated(async (req: TransactionIdReq, res: Response) => {
    try {
      const id = req.validated.params.id
      const transaction = await posAggregatesService.getFailedTransactionById(id)
      sendSuccess(res, transaction, 'Failed transaction retrieved successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  })

  /**
   * Fix and retry a failed transaction
   * POST /aggregated-transactions/failed/:id/fix
   */
  fixFailed = withValidated(async (req: UpdateTransactionReq, res: Response) => {
    try {
      const id = req.validated.params.id
      const transaction = await posAggregatesService.fixFailedTransaction(id, req.validated.body)
      sendSuccess(res, transaction, 'Failed transaction fixed successfully')
    } catch (error: any) {
      handleError(res, error)
    }
  })

  /**
   * Batch fix multiple failed transactions
   * POST /aggregated-transactions/failed/batch-fix
   */
  batchFixFailed = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { ids, updates } = req.body
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return handleError(res, new Error('ids array is required'))
      }
      const result = await posAggregatesService.batchFixFailedTransactions(ids, updates || {})
      sendSuccess(res, result, 'Batch fix completed', 200, {
        fixed_count: result.fixed.length,
        failed_count: result.failed.length
      })
    } catch (error: any) {
      handleError(res, error)
    }
  }

  /**
   * Permanently delete a failed transaction
   * DELETE /aggregated-transactions/failed/:id
   */
  deleteFailed = withValidated(async (req: TransactionIdReq, res: Response) => {
    try {
      const id = req.validated.params.id
      const employeeId = req.context?.employee_id
      await posAggregatesService.deleteFailedTransaction(id, employeeId)
      sendSuccess(res, null, 'Failed transaction deleted permanently')
    } catch (error: any) {
      handleError(res, error)
    }
  })
}

export const posAggregatesController = new PosAggregatesController()
