/**
 * POS Transactions Routes
 */

import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware'
import { resolveBranchContext } from '../../../middleware/branch-context.middleware'
import { canView } from '../../../middleware/permission.middleware'
import * as controller from './pos-transactions.controller'

import { PermissionService } from '../../../services/permission.service'

const router = Router()

// Register module permissions
PermissionService.registerModule('pos_imports', 'POS Imports & Staging Management').catch((error) => {
  console.error('Failed to register pos_imports module:', error.message)
})


router.get(
  '/',
  authenticate,
  resolveBranchContext,
  canView('pos_imports'),
  controller.list
)

router.get(
  '/export',
  authenticate,
  resolveBranchContext,
  canView('pos_imports'),
  controller.exportToExcel
)

export default router
