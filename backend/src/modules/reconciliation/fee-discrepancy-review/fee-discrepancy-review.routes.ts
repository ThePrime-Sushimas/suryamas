import { Router } from 'express'
import { feeDiscrepancyReviewController } from './fee-discrepancy-review.controller'
import { feeDiscrepancyListSchema, feeDiscrepancySummarySchema, feeDiscrepancyUpdateStatusSchema, feeDiscrepancyCreateCorrectionSchema, feeDiscrepancyUndoCorrectionSchema } from './fee-discrepancy-review.schema'
import { validateSchema } from '@/middleware/validation.middleware'
import { authenticate } from '@/middleware/auth.middleware'
import { resolveBranchContext } from '@/middleware/branch-context.middleware'
import { canView, canUpdate, canInsert, canDelete } from '@/middleware/permission.middleware'
import { PermissionService } from '@/services/permission.service'

const router = Router()

PermissionService.registerModule(
  'fee_discrepancy_review',
  'Fee Discrepancy Review',
).catch((err) => console.error('Failed to register fee_discrepancy_review module:', err))

router.use(authenticate, resolveBranchContext)

router.get(
  '/',
  canView('fee_discrepancy_review'),
  validateSchema(feeDiscrepancyListSchema),
  (req, res) => feeDiscrepancyReviewController.list(req, res)
)

router.get(
  '/summary',
  canView('fee_discrepancy_review'),
  validateSchema(feeDiscrepancySummarySchema),
  (req, res) => feeDiscrepancyReviewController.summary(req, res)
)

router.patch(
  '/:source/:sourceId/status',
  canUpdate('fee_discrepancy_review'),
  validateSchema(feeDiscrepancyUpdateStatusSchema),
  (req, res) => feeDiscrepancyReviewController.updateStatus(req, res)
)

router.post(
  '/:source/:sourceId/correct',
  canInsert('fee_discrepancy_review'),
  validateSchema(feeDiscrepancyCreateCorrectionSchema),
  (req, res) => feeDiscrepancyReviewController.createCorrection(req, res)
)

router.delete(
  '/:source/:sourceId/correct',
  canDelete('fee_discrepancy_review'),
  validateSchema(feeDiscrepancyUndoCorrectionSchema),
  (req, res) => feeDiscrepancyReviewController.undoCorrection(req, res)
)

export default router
