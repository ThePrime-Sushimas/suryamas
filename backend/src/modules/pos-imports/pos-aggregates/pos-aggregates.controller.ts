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
import { getBranchReadScope, getAccessibleBranchNames, requireBranchAccess } from '../../../utils/branch-access.util'
import type { AggregatedTransactionFilterParams } from './pos-aggregates.types'

type CreateReq = ValidatedAuthRequest<typeof createAggregatedTransactionSchema>
type UpdateReq = ValidatedAuthRequest<typeof updateAggregatedTransactionSchema>
type IdReq = ValidatedAuthRequest<typeof aggregatedTransactionIdSchema>
type ListReq = ValidatedAuthRequest<typeof aggregatedTransactionListQuerySchema>
type BatchReconcileReq = ValidatedAuthRequest<typeof batchReconcileSchema>
type CreateBatchReq = ValidatedAuthRequest<typeof createBatchSchema>
type BatchAssignJournalReq = ValidatedAuthRequest<typeof batchAssignJournalSchema>
type RecalcFeeReq = ValidatedAuthRequest<typeof recalculateFeeSchema>

async function getAccess(req: Request) {
  const scope = await getBranchReadScope(req)
  const branchNames = await getAccessibleBranchNames(scope.userId)
  return { ...scope, branchNames }
}

function withAccessibleBranches(
  filter: AggregatedTransactionFilterParams | undefined,
  branchIds: string[],
): AggregatedTransactionFilterParams {
  return { ...filter, accessible_branch_ids: branchIds }
}

function intersectBranchNames(requested: string[] | undefined, accessible: string[]): string[] | undefined {
  if (!requested?.length) return undefined
  const allowed = new Set(accessible.map((n) => n.trim().toLowerCase()))
  const matched = requested.filter((n) => allowed.has(n.trim().toLowerCase()))
  return matched.length > 0 ? matched : ['__no_access__']
}

function assertBranchNameAccess(branchName: string | undefined, accessible: string[]): void {
  if (!branchName) return
  const allowed = new Set(accessible.map((n) => n.trim().toLowerCase()))
  if (!allowed.has(branchName.trim().toLowerCase())) {
    const err = new Error('No access to this branch') as Error & { statusCode?: number }
    err.statusCode = 403
    throw err
  }
}

export class PosAggregatesController {
  create = async (req: Request, res: Response) => {
    try {
      const { branchIds, branchNames } = await getAccess(req)
      const { body } = (req as CreateReq).validated
      if (body.branch_id) requireBranchAccess(body.branch_id, branchIds)
      else assertBranchNameAccess(body.branch_name ?? undefined, branchNames)
      const access = { branchIds, branchNames }
      const transaction = await posAggregatesService.createTransaction(
        body as Parameters<typeof posAggregatesService.createTransaction>[0],
        false,
        access,
      )
      sendSuccess(res, transaction, 'Aggregated transaction created successfully', 201)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'create_aggregated_transaction' })
    }
  }

  list = async (req: Request, res: Response) => {
    try {
      const { branchIds, branchNames } = await getAccess(req)
      const { query } = (req as ListReq).validated
      if (query.branch_id) requireBranchAccess(query.branch_id, branchIds)
      const filter = withAccessibleBranches(
        {
          ...query,
          branch_names: intersectBranchNames(
            query.branch_names
              ? (Array.isArray(query.branch_names) ? query.branch_names : String(query.branch_names).split(','))
              : undefined,
            branchNames,
          ),
        },
        branchIds,
      )
      const result = await posAggregatesService.getTransactions(filter)
      sendSuccess(res, result.data, 'Aggregated transactions retrieved successfully', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_aggregated_transactions' })
    }
  }

  findById = async (req: Request, res: Response) => {
    try {
      const { branchIds, branchNames } = await getAccess(req)
      const { id } = (req as IdReq).validated.params
      const access = { branchIds, branchNames }
      const transaction = await posAggregatesService.getTransactionById(id, access)
      sendSuccess(res, transaction, 'Aggregated transaction retrieved successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_aggregated_transaction', id: req.params.id })
    }
  }

  update = async (req: Request, res: Response) => {
    try {
      const { branchIds, branchNames } = await getAccess(req)
      const { params, body } = (req as UpdateReq).validated
      const access = { branchIds, branchNames }
      const transaction = await posAggregatesService.updateTransaction(params.id, body, body.version, access)
      sendSuccess(res, transaction, 'Aggregated transaction updated successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'update_aggregated_transaction', id: req.params.id })
    }
  }

  delete = async (req: Request, res: Response) => {
    try {
      const { branchIds, branchNames } = await getAccess(req)
      const { id } = (req as IdReq).validated.params
      const access = { branchIds, branchNames }
      await posAggregatesService.deleteTransaction(id, req.user?.id, access)
      sendSuccess(res, null, 'Aggregated transaction deleted successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_aggregated_transaction', id: req.params.id })
    }
  }

  restore = async (req: Request, res: Response) => {
    try {
      const { branchIds, branchNames } = await getAccess(req)
      const { id } = (req as IdReq).validated.params
      const access = { branchIds, branchNames }
      await posAggregatesService.restoreTransaction(id, req.user?.id, access)
      sendSuccess(res, null, 'Aggregated transaction restored successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'restore_aggregated_transaction', id: req.params.id })
    }
  }

  reconcile = async (req: Request, res: Response) => {
    try {
      const { branchIds, branchNames } = await getAccess(req)
      const { id } = (req as IdReq).validated.params
      const reconciledBy = req.user?.id
      if (!reconciledBy) throw new Error('Authentication required')
      const reason = req.body.reason as string | undefined
      const access = { branchIds, branchNames }
      await posAggregatesService.reconcileTransaction(id, reconciledBy, reason, access)
      sendSuccess(res, null, 'Transaction reconciled successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'reconcile_transaction', id: req.params.id })
    }
  }

  batchReconcile = async (req: Request, res: Response) => {
    try {
      const { branchIds, branchNames } = await getAccess(req)
      const { transaction_ids } = (req as BatchReconcileReq).validated.body
      const reconciledBy = req.user?.id
      if (!reconciledBy) throw new Error('Authentication required')
      const access = { branchIds, branchNames }
      const count = await posAggregatesService.reconcileBatch(transaction_ids, reconciledBy, access)
      sendSuccess(res, { reconciled_count: count }, `${count} transactions reconciled successfully`)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'batch_reconcile' })
    }
  }

  createBatch = async (req: Request, res: Response) => {
    try {
      const { branchIds, branchNames } = await getAccess(req)
      const { transactions } = (req as CreateBatchReq).validated.body
      const access = { branchIds, branchNames }
      const result = await posAggregatesService.createBatch(
        transactions as Parameters<typeof posAggregatesService.createBatch>[0],
        access,
      )
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
      const { branchIds, branchNames } = await getAccess(req)
      const { transaction_ids, journal_id } = (req as BatchAssignJournalReq).validated.body
      const access = { branchIds, branchNames }
      const result = await posAggregatesService.assignJournalBatch(transaction_ids, journal_id, access)
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
      const { branchIds, branchNames } = await getAccess(req)
      const q = (req as ListReq).validated.query
      let branchNamesArray: string[] | undefined
      if (q.branch_names) {
        branchNamesArray = Array.isArray(q.branch_names)
          ? q.branch_names.map(b => String(b).trim()).filter(Boolean)
          : String(q.branch_names).split(',').map(b => b.trim()).filter(Boolean)
      }
      branchNamesArray = intersectBranchNames(branchNamesArray, branchNames)
      let paymentMethodIdsArray: number[] | undefined
      if (q.payment_method_ids) {
        paymentMethodIdsArray = (Array.isArray(q.payment_method_ids) ? q.payment_method_ids : String(q.payment_method_ids).split(','))
          .map(id => Number(id)).filter(id => !isNaN(id))
      }
      const summary = await posAggregatesService.getSummary(
        q.transaction_date_from ?? undefined, q.transaction_date_to ?? undefined,
        branchNamesArray, paymentMethodIdsArray, q.status ?? undefined, q.is_reconciled,
        branchIds,
      )
      sendSuccess(res, summary, 'Summary retrieved successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_summary' })
    }
  }

  assignJournal = async (req: Request, res: Response) => {
    try {
      const { branchIds, branchNames } = await getAccess(req)
      const { id } = (req as IdReq).validated.params
      const { journal_id } = req.body
      const access = { branchIds, branchNames }
      await posAggregatesService.assignJournal(id, journal_id, access)
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
      const { branchIds, branchNames } = await getAccess(req)
      const q = (req as ListReq).validated.query
      const branchName = q.branch_name ?? undefined
      assertBranchNameAccess(branchName, branchNames)
      const transactions = await posAggregatesService.getUnreconciledTransactions(
        q.transaction_date_from ?? undefined,
        q.transaction_date_to ?? undefined,
        branchName,
        branchIds,
      )
      sendSuccess(res, transactions, 'Unreconciled transactions retrieved successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_unreconciled' })
    }
  }

  listFailed = async (req: Request, res: Response) => {
    try {
      const { branchIds, branchNames } = await getAccess(req)
      const { query } = (req as ListReq).validated
      const filter = withAccessibleBranches(query, branchIds)
      const result = await posAggregatesService.getFailedTransactions(filter)
      sendSuccess(res, result.data, 'Failed transactions retrieved successfully', 200, result.pagination)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'list_failed_transactions' })
    }
  }

  findFailedById = async (req: Request, res: Response) => {
    try {
      const { branchIds, branchNames } = await getAccess(req)
      const { id } = (req as IdReq).validated.params
      const access = { branchIds, branchNames }
      const transaction = await posAggregatesService.getFailedTransactionById(id, access)
      sendSuccess(res, transaction, 'Failed transaction retrieved successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'get_failed_transaction', id: req.params.id })
    }
  }

  fixFailed = async (req: Request, res: Response) => {
    try {
      const { branchIds, branchNames } = await getAccess(req)
      const { params, body } = (req as UpdateReq).validated
      const access = { branchIds, branchNames }
      const transaction = await posAggregatesService.fixFailedTransaction(params.id, body, access)
      sendSuccess(res, transaction, 'Failed transaction fixed successfully')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'fix_failed_transaction', id: req.params.id })
    }
  }

  batchFixFailed = async (req: Request, res: Response) => {
    try {
      const { branchIds, branchNames } = await getAccess(req)
      const { ids, updates } = req.body
      if (!ids || !Array.isArray(ids) || ids.length === 0) throw new Error('ids array is required')
      const access = { branchIds, branchNames }
      const result = await posAggregatesService.batchFixFailedTransactions(ids, updates || {}, access)
      sendSuccess(res, result, 'Batch fix completed')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'batch_fix_failed' })
    }
  }

  deleteFailed = async (req: Request, res: Response) => {
    try {
      const { branchIds, branchNames } = await getAccess(req)
      const { id } = (req as IdReq).validated.params
      const access = { branchIds, branchNames }
      await posAggregatesService.deleteFailedTransaction(id, req.user?.id, access)
      sendSuccess(res, null, 'Failed transaction deleted permanently')
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'delete_failed_transaction', id: req.params.id })
    }
  }

  recalculateFee = async (req: Request, res: Response) => {
    try {
      const { branchIds } = await getAccess(req)
      const { body } = (req as RecalcFeeReq).validated
      const result = await posAggregatesService.recalculateFeeByDate(
        body.transaction_date,
        req.user?.id,
        branchIds,
      )
      sendSuccess(res, result, `Fee recalculated: ${result.updated} updated, ${result.skipped} skipped`)
    } catch (error: unknown) {
      await handleError(res, error, req, { action: 'recalculate_fee' })
    }
  }
}

export const posAggregatesController = new PosAggregatesController()
