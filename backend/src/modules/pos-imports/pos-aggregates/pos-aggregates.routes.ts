

import { Router } from 'express'
import { posAggregatesController } from './pos-aggregates.controller'
import { validateSchema } from '../../../middleware/validation.middleware'
import { authenticate } from '../../../middleware/auth.middleware'
import { resolveBranchContext } from '../../../middleware/branch-context.middleware'
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
  posAggregatesController.generateFromImport
)

/**
 * @route GET /check-source
 * @desc Check if source already exists
 * @access Private
 */
router.get(
  '/check-source',
  posAggregatesController.checkSource
)

/**
 * @route POST /
 * @desc Create new aggregated transaction
 * @access Private
 */
router.post(
  '/',
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
  validateSchema(batchAssignJournalSchema),
  posAggregatesController.batchAssignJournal
)

export default router


