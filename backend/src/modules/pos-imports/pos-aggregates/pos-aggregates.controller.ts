import { Request, Response } from 'express'
import { posAggregatesService } from './pos-aggregates.service'
import { sendSuccess } from '../../../utils/response.util'
import { handleError } from '../../../utils/error-handler.util'
import type { ValidatedAuthRequest } from '../../../middleware/validation.middleware'
import {
  createAggregatedTransactionSchema, updateAggregatedTransactionSchema,
  aggregatedTransactionIdSchema, aggregatedTransactionListQuerySchema,
  batchReconcileSchema, createBatchSchema, batchAssignJournalSchema, recalculateFeeSchema,
} from './pos-aggregates.schema'

type CreateReq = ValidatedAuthRequest<typeof createAggregatedTransactionSchema>
type UpdateReq = ValidatedAuthRequest<typeof updateAggregatedTransactionSchema>
type IdReq = ValidatedAuthRequest<typeof aggregatedTransactionIdSchema>
type ListReq = ValidatedAuthRequest<typeof aggregatedTransactionListQuerySchema>
type BatchReconcileReq = ValidatedAuthRequest<typeof batchReconcileSchema>
type CreateBatchReq = ValidatedAuthRequest<typeof createBatchSchema>
type BatchAssignJournalReq = ValidatedAuthRequest<typeof batchAssignJournalSchema>
type RecalcFeeReq = ValidatedAuthRequest<typeof recalculateFeeSchema>

export class PosAggregatesController {
  create = async (req: Request, res: Response) => {
    try {
      const { body } = (req as CreateReq).validated
      const transaction = await posAggregatesService.createTransaction(body as Parameters<typeof posAggregatesService.createTransaction>[0])
      sendSuccess(res, transaction, 'Aggregated transaction created successfully', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_aggregated_transaction' })
    }
  }

  list = async (req: Request, res: Response) => {
    try {
      const { query } = (req as ListReq).validated
      const result = await posAggregatesService.getTransactions(query)
      sendSuccess(res, result.data, 'Aggregated transactions retrieved successfully', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_aggregated_transactions' })
    }
  }

  findById = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const transaction = await posAggregatesService.getTransactionById(id)
      sendSuccess(res, transaction, 'Aggregated transaction retrieved successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_aggregated_transaction', id: req.params.id })
    }
  }

  update = async (req: Request, res: Response) => {
    try {
      const { params, body } = (req as UpdateReq).validated
      const transaction = await posAggregatesService.updateTransaction(params.id, body, body.version)
      sendSuccess(res, transaction, 'Aggregated transaction updated successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_aggregated_transaction', id: req.params.id })
    }
  }

  delete = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      await posAggregatesService.deleteTransaction(id, req.context?.employee_id)
      sendSuccess(res, null, 'Aggregated transaction deleted successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_aggregated_transaction', id: req.params.id })
    }
  }

  restore = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      await posAggregatesService.restoreTransaction(id)
      sendSuccess(res, null, 'Aggregated transaction restored successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'restore_aggregated_transaction', id: req.params.id })
    }
  }

  reconcile = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const reconciledBy = req.context?.employee_id || req.body.reconciled_by
      if (!reconciledBy) throw new Error('reconciled_by is required')
      const reason = req.body.reason as string | undefined
      await posAggregatesService.reconcileTransaction(id, reconciledBy, reason)
      sendSuccess(res, null, 'Transaction reconciled successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'reconcile_transaction', id: req.params.id })
    }
  }

  batchReconcile = async (req: Request, res: Response) => {
    try {
      const { transaction_ids, reconciled_by } = (req as BatchReconcileReq).validated.body
      const count = await posAggregatesService.reconcileBatch(transaction_ids, reconciled_by)
      sendSuccess(res, { reconciled_count: count }, `${count} transactions reconciled successfully`)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'batch_reconcile' })
    }
  }

  createBatch = async (req: Request, res: Response) => {
    try {
      const { transactions } = (req as CreateBatchReq).validated.body
      const result = await posAggregatesService.createBatch(transactions as Parameters<typeof posAggregatesService.createBatch>[0])
      sendSuccess(res, result, 'Batch transaction creation completed', 200, {
        total_processed: result.total_processed,
        success_count: result.success.length,
        failed_count: result.failed.length,
      })
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_batch' })
    }
  }

  batchAssignJournal = async (req: Request, res: Response) => {
    try {
      const { transaction_ids, journal_id } = (req as BatchAssignJournalReq).validated.body
      const result = await posAggregatesService.assignJournalBatch(transaction_ids, journal_id)
      sendSuccess(res, result, 'Batch journal assignment completed', 200, {
        assigned: result.assigned,
        skipped: result.skipped,
      })
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'batch_assign_journal' })
    }
  }

  getSummary = async (req: Request, res: Response) => {
    try {
      const q = (req as ListReq).validated.query
      let branchNamesArray: string[] | undefined
      if (q.branch_names) {
        branchNamesArray = Array.isArray(q.branch_names)
          ? q.branch_names.map(b => String(b).trim()).filter(Boolean)
          : String(q.branch_names).split(',').map(b => b.trim()).filter(Boolean)
      }
      let paymentMethodIdsArray: number[] | undefined
      if (q.payment_method_ids) {
        paymentMethodIdsArray = (Array.isArray(q.payment_method_ids) ? q.payment_method_ids : String(q.payment_method_ids).split(','))
          .map(id => Number(id)).filter(id => !isNaN(id))
      }
      const summary = await posAggregatesService.getSummary(
        q.transaction_date_from ?? undefined, q.transaction_date_to ?? undefined,
        branchNamesArray, paymentMethodIdsArray, q.status ?? undefined, q.is_reconciled,
      )
      sendSuccess(res, summary, 'Summary retrieved successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_summary' })
    }
  }

  assignJournal = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const { journal_id } = req.body
      await posAggregatesService.assignJournal(id, journal_id)
      sendSuccess(res, null, 'Journal assigned successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'assign_journal', id: req.params.id })
    }
  }

  checkSource = async (req: Request, res: Response) => {
    try {
      const { source_type, source_id, source_ref } = req.query
      const exists = await posAggregatesService.checkSourceExists(
        source_type as 'POS', source_id as string, source_ref as string
      )
      sendSuccess(res, { exists }, 'Source check completed')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'check_source' })
    }
  }

  getUnreconciled = async (req: Request, res: Response) => {
    try {
      const q = (req as ListReq).validated.query
      const transactions = await posAggregatesService.getUnreconciledTransactions(
        q.transaction_date_from ?? undefined, q.transaction_date_to ?? undefined, q.branch_name ?? undefined
      )
      sendSuccess(res, transactions, 'Unreconciled transactions retrieved successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_unreconciled' })
    }
  }

  listFailed = async (req: Request, res: Response) => {
    try {
      const { query } = (req as ListReq).validated
      const result = await posAggregatesService.getFailedTransactions(query)
      sendSuccess(res, result.data, 'Failed transactions retrieved successfully', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_failed_transactions' })
    }
  }

  findFailedById = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      const transaction = await posAggregatesService.getFailedTransactionById(id)
      sendSuccess(res, transaction, 'Failed transaction retrieved successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_failed_transaction', id: req.params.id })
    }
  }

  fixFailed = async (req: Request, res: Response) => {
    try {
      const { params, body } = (req as UpdateReq).validated
      const transaction = await posAggregatesService.fixFailedTransaction(params.id, body)
      sendSuccess(res, transaction, 'Failed transaction fixed successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'fix_failed_transaction', id: req.params.id })
    }
  }

  batchFixFailed = async (req: Request, res: Response) => {
    try {
      const { ids, updates } = req.body
      if (!ids || !Array.isArray(ids) || ids.length === 0) throw new Error('ids array is required')
      const result = await posAggregatesService.batchFixFailedTransactions(ids, updates || {})
      sendSuccess(res, result, 'Batch fix completed')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'batch_fix_failed' })
    }
  }

  deleteFailed = async (req: Request, res: Response) => {
    try {
      const { id } = (req as IdReq).validated.params
      await posAggregatesService.deleteFailedTransaction(id, req.context?.employee_id)
      sendSuccess(res, null, 'Failed transaction deleted permanently')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_failed_transaction', id: req.params.id })
    }
  }

  recalculateFee = async (req: Request, res: Response) => {
    try {
      const { body } = (req as RecalcFeeReq).validated
      const result = await posAggregatesService.recalculateFeeByDate(body.transaction_date, req.context?.employee_id)
      sendSuccess(res, result, `Fee recalculated: ${result.updated} updated, ${result.skipped} skipped`)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'recalculate_fee' })
    }
  }
}

export const posAggregatesController = new PosAggregatesController()
