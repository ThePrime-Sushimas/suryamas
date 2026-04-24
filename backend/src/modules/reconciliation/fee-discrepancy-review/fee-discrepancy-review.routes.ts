import { Router } from 'express'
import { feeDiscrepancyReviewController } from './fee-discrepancy-review.controller'
import { feeDiscrepancyListSchema, feeDiscrepancySummarySchema } from './fee-discrepancy-review.schema'
import { validateSchema } from '@/middleware/validation.middleware'
import { authenticate } from '@/middleware/auth.middleware'
import { resolveBranchContext } from '@/middleware/branch-context.middleware'
import { canView } from '@/middleware/permission.middleware'
import { PermissionService } from '@/services/permission.service'

const router = Router()

// Register module in permission system
PermissionService.registerModule(
  'fee_discrepancy_review',
  'Fee Discrepancy Review',
).catch(() => {})

// Middleware order: authenticate → resolveBranchContext → permission → validateSchema
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

export default router

import type { ValidatedAuthRequest } from '@/middleware/validation.middleware'
