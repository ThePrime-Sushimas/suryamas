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
  recalculateFeeSchema,
} from './pos-aggregates.schema'

// Register module permissions
PermissionService.registerModule('pos_aggregates', 'POS Aggregates Management').catch((error) => {
  console.error('Failed to register pos_aggregates module:', error instanceof Error ? error.message : error)
})

const router = Router()

// Apply auth middleware to all routes
router.use(authenticate)
router.use(resolveBranchContext)

// =============================================================================
// FAILED TRANSACTIONS ROUTES - MUST be defined BEFORE /:id to avoid route conflicts
// =============================================================================

/**
 * @route GET /failed
 * @desc List failed transactions with pagination and filters
 * @access Private
 */
router.get(
  '/failed',
  canView('pos_aggregates'),
  validateSchema(aggregatedTransactionListQuerySchema),
  (req, res) => posAggregatesController.listFailed(req, res)
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
  (req, res) => posAggregatesController.findFailedById(req, res)
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
  (req, res) => posAggregatesController.fixFailed(req, res)
)

/**
 * @route POST /failed/batch-fix
 * @desc Batch fix multiple failed transactions
 * @access Private
 */
router.post(
  '/failed/batch-fix',
  canUpdate('pos_aggregates'),
  (req, res) => posAggregatesController.batchFixFailed(req, res)
)

/**
 * @route POST /recalculate-fee
 * @desc Recalculate fee for POS Import records by date
 * @access Private
 */
router.post(
  '/recalculate-fee',
  canUpdate('pos_aggregates'),
  validateSchema(recalculateFeeSchema),
  (req, res) => posAggregatesController.recalculateFee(req, res)
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
  (req, res) => posAggregatesController.deleteFailed(req, res)
)

// =============================================================================
// MAIN TRANSACTIONS ROUTES
// =============================================================================

/**
 * @route GET /
 * @desc List aggregated transactions with pagination and filters
 * @access Private
 */
router.get(
  '/',
  canView('pos_aggregates'),
  validateSchema(aggregatedTransactionListQuerySchema),
  (req, res) => posAggregatesController.list(req, res)
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
  (req, res) => posAggregatesController.getSummary(req, res)
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
  (req, res) => posAggregatesController.getUnreconciled(req, res)
)

/**
 * @route GET /check-source
 * @desc Check if source already exists
 * @access Private
 */
router.get(
  '/check-source',
  canView('pos_aggregates'),
  (req, res) => posAggregatesController.checkSource(req, res)
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
  (req, res) => posAggregatesController.create(req, res)
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
  (req, res) => posAggregatesController.batchReconcile(req, res)
)

/**
 * @route POST /batch
 * @desc Create multiple transactions (batch)
 * @access Private
 */
router.post(
  '/batch',
  canInsert('pos_aggregates'),
  validateSchema(createBatchSchema),
  (req, res) => posAggregatesController.createBatch(req, res)
)

/**
 * @route POST /batch/assign-journal
 * @desc Batch assign journal to multiple transactions
 * @access Private
 */
router.post(
  '/batch/assign-journal',
  canUpdate('pos_aggregates'),
  validateSchema(batchAssignJournalSchema),
  (req, res) => posAggregatesController.batchAssignJournal(req, res)
)

/**
 * @route GET /:id
 * @desc Get single aggregated transaction
 * @access Private
 * @note This route MUST be defined AFTER all /failed routes to avoid conflicts
 */
router.get(
  '/:id',
  canView('pos_aggregates'),
  validateSchema(aggregatedTransactionIdSchema),
  (req, res) => posAggregatesController.findById(req, res)
)

/**
 * @route PUT /:id
 * @desc Update aggregated transaction
 * @access Private
 */
router.put(
  '/:id',
  canUpdate('pos_aggregates'),
  validateSchema(updateAggregatedTransactionSchema),
  (req, res) => posAggregatesController.update(req, res)
)

/**
 * @route DELETE /:id
 * @desc Soft delete aggregated transaction
 * @access Private
 */
router.delete(
  '/:id',
  canDelete('pos_aggregates'),
  validateSchema(aggregatedTransactionIdSchema),
  (req, res) => posAggregatesController.delete(req, res)
)

/**
 * @route POST /:id/restore
 * @desc Restore soft-deleted transaction
 * @access Private
 */
router.post(
  '/:id/restore',
  canInsert('pos_aggregates'),
  validateSchema(aggregatedTransactionIdSchema),
  (req, res) => posAggregatesController.restore(req, res)
)

/**
 * @route POST /:id/reconcile
 * @desc Mark transaction as reconciled
 * @access Private
 */
router.post(
  '/:id/reconcile',
  canUpdate('pos_aggregates'),
  validateSchema(aggregatedTransactionIdSchema),
  (req, res) => posAggregatesController.reconcile(req, res)
)

/**
 * @route POST /:id/assign-journal
 * @desc Assign journal to transaction
 * @access Private
 */
router.post(
  '/:id/assign-journal',
  canUpdate('pos_aggregates'),
  validateSchema(aggregatedTransactionIdSchema),
  (req, res) => posAggregatesController.assignJournal(req, res)
)

export default router

