

import { Router } from 'express'
import { posAggregatesController } from './pos-aggregates.controller'
import { validateSchema } from '../../../middleware/validation.middleware'
import { authenticate } from '../../../middleware/auth.middleware'
import { resolveBranchContext } from '../../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../../middleware/permission.middleware'
import { PermissionService } from '../../../services/permission.service'
import {
  createAggregatedTransactionSchema,
  updateAggregatedTransactionSchema,
  aggregatedTransactionIdSchema,
  aggregatedTransactionListQuerySchema,
  generateJournalSchema,
  batchReconcileSchema,
  createBatchSchema,
  batchAssignJournalSchema,
} from './pos-aggregates.schema'

// Register module permissions
PermissionService.registerModule('pos_aggregates', 'POS Aggregates Management').catch((error) => {
  console.error('Failed to register pos_aggregates module:', error.message)
})

const router = Router()

// Apply auth middleware to all routes
router.use(authenticate)
router.use(resolveBranchContext)

/**
 * @route GET /
 * @desc List aggregated transactions with pagination and filters
 * @access Private
 */
router.get(
  '/',
  canView('pos_aggregates'),
  validateSchema(aggregatedTransactionListQuerySchema),
  posAggregatesController.list
)

/**
 * @route GET /summary
 * @desc Get summary statistics
 * @access Private
 */
router.get(
  '/summary',
  canView('pos_aggregates'),
  validateSchema(aggregatedTransactionListQuerySchema),
  posAggregatesController.getSummary
)

/**
 * @route GET /unreconciled
 * @desc Get unreconciled transactions
 * @access Private
 */
router.get(
  '/unreconciled',
  canView('pos_aggregates'),
  validateSchema(aggregatedTransactionListQuerySchema),
  posAggregatesController.getUnreconciled
)

/**
 * @route POST /generate-from-import/:importId
 * @desc Generate aggregated transactions from POS import lines
 * @access Private
 */
router.post(
  '/generate-from-import/:importId',
  canInsert('pos_aggregates'),
  posAggregatesController.generateFromImport
)

/**
 * @route GET /check-source
 * @desc Check if source already exists
 * @access Private
 */
router.get(
  '/check-source',
  canView('pos_aggregates'),
  posAggregatesController.checkSource
)

/**
 * @route POST /
 * @desc Create new aggregated transaction
 * @access Private
 */
router.post(
  '/',
  canInsert('pos_aggregates'),
  validateSchema(createAggregatedTransactionSchema),
  posAggregatesController.create
)

/**
 * @route POST /generate-journal
 * @desc Generate journal entries from eligible transactions
 * @access Private
 */
router.post(
  '/generate-journal',
  canUpdate('pos_aggregates'),
  validateSchema(generateJournalSchema),
  posAggregatesController.generateJournal
)

/**
 * @route POST /batch/reconcile
 * @desc Batch reconcile transactions
 * @access Private
 */
router.post(
  '/batch/reconcile',
  canUpdate('pos_aggregates'),
  validateSchema(batchReconcileSchema),
  posAggregatesController.batchReconcile
)

/**
 * @route GET /aggregated-transactions/:id
 * @desc Get single aggregated transaction
 * @access Private
 */
router.get(
  '/:id',
  canView('pos_aggregates'),
  validateSchema(aggregatedTransactionIdSchema),
  posAggregatesController.findById
)

/**
 * @route PUT /aggregated-transactions/:id
 * @desc Update aggregated transaction
 * @access Private
 */
router.put(
  '/:id',
  canUpdate('pos_aggregates'),
  validateSchema(updateAggregatedTransactionSchema),
  posAggregatesController.update
)

/**
 * @route DELETE /aggregated-transactions/:id
 * @desc Soft delete aggregated transaction
 * @access Private
 */
router.delete(
  '/:id',
  canDelete('pos_aggregates'),
  validateSchema(aggregatedTransactionIdSchema),
  posAggregatesController.delete
)

/**
 * @route POST /aggregated-transactions/:id/restore
 * @desc Restore soft-deleted transaction
 * @access Private
 */
router.post(
  '/:id/restore',
  canInsert('pos_aggregates'),
  validateSchema(aggregatedTransactionIdSchema),
  posAggregatesController.restore
)

/**
 * @route POST /aggregated-transactions/:id/reconcile
 * @desc Mark transaction as reconciled
 * @access Private
 */
router.post(
  '/:id/reconcile',
  canUpdate('pos_aggregates'),
  validateSchema(aggregatedTransactionIdSchema),
  posAggregatesController.reconcile
)

/**
 * @route POST /aggregated-transactions/:id/assign-journal
 * @desc Assign journal to transaction
 * @access Private
 */
router.post(
  '/:id/assign-journal',
  canUpdate('pos_aggregates'),
  validateSchema(aggregatedTransactionIdSchema),
  posAggregatesController.assignJournal
)

/**
 * @route POST /aggregated-transactions/batch
 * @desc Create multiple transactions (batch)
 * @access Private
 */
router.post(
  '/batch',
  canInsert('pos_aggregates'),
  validateSchema(createBatchSchema),
  posAggregatesController.createBatch
)

/**
 * @route POST /aggregated-transactions/batch/assign-journal
 * @desc Batch assign journal to multiple transactions
 * @access Private
 */
router.post(
  '/batch/assign-journal',
  canUpdate('pos_aggregates'),
  validateSchema(batchAssignJournalSchema),
  posAggregatesController.batchAssignJournal
)

/**
 * @route GET /failed
 * @desc List failed transactions with pagination and filters
 * @access Private
 */
router.get(
  '/failed',
  canView('pos_aggregates'),
  validateSchema(aggregatedTransactionListQuerySchema),
  posAggregatesController.listFailed
)

/**
 * @route GET /failed/:id
 * @desc Get failed transaction details
 * @access Private
 */
router.get(
  '/failed/:id',
  canView('pos_aggregates'),
  validateSchema(aggregatedTransactionIdSchema),
  posAggregatesController.findFailedById
)

/**
 * @route POST /failed/:id/fix
 * @desc Fix and retry a failed transaction
 * @access Private
 */
router.post(
  '/failed/:id/fix',
  canUpdate('pos_aggregates'),
  validateSchema(updateAggregatedTransactionSchema),
  posAggregatesController.fixFailed
)

/**
 * @route POST /failed/batch-fix
 * @desc Batch fix multiple failed transactions
 * @access Private
 */
router.post(
  '/failed/batch-fix',
  canUpdate('pos_aggregates'),
  posAggregatesController.batchFixFailed
)

/**
 * @route DELETE /failed/:id
 * @desc Permanently delete a failed transaction
 * @access Private
 */
router.delete(
  '/failed/:id',
  canDelete('pos_aggregates'),
  validateSchema(aggregatedTransactionIdSchema),
  posAggregatesController.deleteFailed
)

export default router


