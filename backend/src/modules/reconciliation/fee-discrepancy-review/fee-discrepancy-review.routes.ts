import { Router } from 'express'
import { feeDiscrepancyReviewController } from './fee-discrepancy-review.controller'
import { feeDiscrepancyListSchema, feeDiscrepancySummarySchema, feeDiscrepancyUpdateStatusSchema, feeDiscrepancyCreateCorrectionSchema } from './fee-discrepancy-review.schema'
import type { ValidatedAuthRequest } from '@/middleware/validation.middleware'
import { validateSchema } from '@/middleware/validation.middleware'
import { authenticate } from '@/middleware/auth.middleware'
import { resolveBranchContext } from '@/middleware/branch-context.middleware'
import { canView, canUpdate, canInsert } from '@/middleware/permission.middleware'
import { PermissionService } from '@/services/permission.service'

const router = Router()

PermissionService.registerModule(
  'fee_discrepancy_review',
  'Fee Discrepancy Review',
).catch(() => {})

router.use(authenticate, resolveBranchContext)

router.get(
  '/',
  canView('fee_discrepancy_review'),
  validateSchema(feeDiscrepancyListSchema),
  (req, res) => feeDiscrepancyReviewController.list(req as ValidatedAuthRequest<typeof feeDiscrepancyListSchema>, res)
)

router.get(
  '/summary',
  canView('fee_discrepancy_review'),
  validateSchema(feeDiscrepancySummarySchema),
  (req, res) => feeDiscrepancyReviewController.summary(req as ValidatedAuthRequest<typeof feeDiscrepancySummarySchema>, res)
)

router.patch(
  '/:source/:sourceId/status',
  canUpdate('fee_discrepancy_review'),
  validateSchema(feeDiscrepancyUpdateStatusSchema),
  (req, res) => feeDiscrepancyReviewController.updateStatus(req as ValidatedAuthRequest<typeof feeDiscrepancyUpdateStatusSchema>, res)
)

router.post(
  '/:source/:sourceId/correct',
  canInsert('fee_discrepancy_review'),
  validateSchema(feeDiscrepancyCreateCorrectionSchema),
  (req, res) => feeDiscrepancyReviewController.createCorrection(req as ValidatedAuthRequest<typeof feeDiscrepancyCreateCorrectionSchema>, res)
)

export default router
